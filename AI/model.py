"""
CodeLM - 350M Parameter Decoder-only Transformer
Architektur: GPT-Style mit RoPE, SwiGLU, RMSNorm, Grouped Query Attention
Optimiert für RTX 4070 Ti (12GB VRAM)
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from dataclasses import dataclass
from typing import Optional


# ---------------------------------------------------------------------------
# Konfiguration
# ---------------------------------------------------------------------------

@dataclass
class ModelConfig:
    # Modell-Dimensionen
    vocab_size: int = 32000
    hidden_size: int = 1024
    num_layers: int = 24
    num_attention_heads: int = 16
    num_kv_heads: int = 8          # Grouped Query Attention (GQA)
    ffn_hidden_size: int = 4096    # Vor SwiGLU-Reduktion
    max_seq_len: int = 4096

    # Regularisierung
    dropout: float = 0.0           # Bei Pre-Training meist 0
    attention_dropout: float = 0.0

    # RoPE
    rope_theta: float = 10000.0
    rope_scaling: Optional[float] = None

    # Sonstiges
    tie_embeddings: bool = True    # Input/Output Embedding teilen (spart ~32M Params)
    initializer_range: float = 0.02
    rms_norm_eps: float = 1e-5

    # Spezielle Tokens
    pad_token_id: int = 0
    bos_token_id: int = 1
    eos_token_id: int = 2

    def __post_init__(self):
        assert self.hidden_size % self.num_attention_heads == 0
        assert self.num_attention_heads % self.num_kv_heads == 0
        self.head_dim = self.hidden_size // self.num_attention_heads
        self.num_kv_groups = self.num_attention_heads // self.num_kv_heads

    @property
    def num_parameters(self) -> int:
        """Schätzt die Anzahl der Parameter."""
        embed = self.vocab_size * self.hidden_size
        attn = self.num_layers * (
            self.hidden_size * self.hidden_size +          # Q
            self.hidden_size * (self.num_kv_heads * self.head_dim) +  # K
            self.hidden_size * (self.num_kv_heads * self.head_dim) +  # V
            self.hidden_size * self.hidden_size            # O
        )
        # SwiGLU hat 3 Matrizen: gate, up, down
        ffn_actual = int(self.ffn_hidden_size * 2 / 3) * 2  # SwiGLU-Reduktion
        ffn = self.num_layers * (
            self.hidden_size * ffn_actual +   # gate
            self.hidden_size * ffn_actual +   # up
            ffn_actual * self.hidden_size     # down
        )
        norm = self.num_layers * 2 * self.hidden_size + self.hidden_size
        lm_head = 0 if self.tie_embeddings else self.vocab_size * self.hidden_size
        return embed + attn + ffn + norm + lm_head


# ---------------------------------------------------------------------------
# RMSNorm
# ---------------------------------------------------------------------------

class RMSNorm(nn.Module):
    def __init__(self, dim: int, eps: float = 1e-5):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq, dim)
        norm = x.float().pow(2).mean(-1, keepdim=True).add(self.eps).rsqrt()
        return (x.float() * norm).to(x.dtype) * self.weight


# ---------------------------------------------------------------------------
# Rotary Position Embedding (RoPE)
# ---------------------------------------------------------------------------

def precompute_rope_freqs(head_dim: int, max_seq_len: int, theta: float = 10000.0) -> torch.Tensor:
    """Vorberechnete RoPE Frequenzen als komplexe Zahlen."""
    freqs = 1.0 / (theta ** (torch.arange(0, head_dim, 2).float() / head_dim))
    t = torch.arange(max_seq_len)
    freqs = torch.outer(t, freqs)
    return torch.polar(torch.ones_like(freqs), freqs)  # komplexe Darstellung


def apply_rope(q: torch.Tensor, k: torch.Tensor, freqs_cis: torch.Tensor) -> tuple:
    """
    Wendet RoPE auf Query und Key an.
    q, k: (batch, seq, heads, head_dim)
    freqs_cis: (seq, head_dim/2) komplex
    """
    def rotate(x, freqs):
        # x: (batch, seq, heads, head_dim) → komplex: (batch, seq, heads, head_dim/2)
        x_c = torch.view_as_complex(x.float().reshape(*x.shape[:-1], -1, 2))
        freqs = freqs.unsqueeze(0).unsqueeze(2)  # (1, seq, 1, head_dim/2)
        x_rotated = torch.view_as_real(x_c * freqs).flatten(-2)
        return x_rotated.to(x.dtype)

    seq_len = q.shape[1]
    freqs_cis = freqs_cis[:seq_len]
    return rotate(q, freqs_cis), rotate(k, freqs_cis)


# ---------------------------------------------------------------------------
# Grouped Query Attention (GQA)
# ---------------------------------------------------------------------------

class GroupedQueryAttention(nn.Module):
    def __init__(self, config: ModelConfig):
        super().__init__()
        self.num_heads = config.num_attention_heads
        self.num_kv_heads = config.num_kv_heads
        self.num_kv_groups = config.num_kv_groups
        self.head_dim = config.head_dim
        self.hidden_size = config.hidden_size
        self.dropout = config.attention_dropout

        # Projektionen
        self.q_proj = nn.Linear(config.hidden_size, config.num_attention_heads * config.head_dim, bias=False)
        self.k_proj = nn.Linear(config.hidden_size, config.num_kv_heads * config.head_dim, bias=False)
        self.v_proj = nn.Linear(config.hidden_size, config.num_kv_heads * config.head_dim, bias=False)
        self.o_proj = nn.Linear(config.num_attention_heads * config.head_dim, config.hidden_size, bias=False)

        self.scale = self.head_dim ** -0.5

    def forward(
        self,
        x: torch.Tensor,
        freqs_cis: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        use_flash: bool = True,
    ) -> torch.Tensor:
        B, T, _ = x.shape

        # Projektionen
        q = self.q_proj(x).view(B, T, self.num_heads, self.head_dim)
        k = self.k_proj(x).view(B, T, self.num_kv_heads, self.head_dim)
        v = self.v_proj(x).view(B, T, self.num_kv_heads, self.head_dim)

        # RoPE anwenden
        q, k = apply_rope(q, k, freqs_cis)

        # GQA: KV-Heads auf Query-Heads expandieren
        # (B, T, num_kv_heads, head_dim) → (B, T, num_heads, head_dim)
        k = k.repeat_interleave(self.num_kv_groups, dim=2)
        v = v.repeat_interleave(self.num_kv_groups, dim=2)

        # (B, T, heads, head_dim) → (B, heads, T, head_dim) für Attention
        q = q.transpose(1, 2)
        k = k.transpose(1, 2)
        v = v.transpose(1, 2)

        # Flash Attention (wenn verfügbar) oder Standard Scaled Dot-Product
        if use_flash and hasattr(F, 'scaled_dot_product_attention'):
            # PyTorch 2.0+ Flash Attention
            attn_out = F.scaled_dot_product_attention(
                q, k, v,
                attn_mask=attention_mask,
                dropout_p=self.dropout if self.training else 0.0,
                is_causal=(attention_mask is None),  # Causal wenn kein explizites Mask
            )
        else:
            # Fallback: Standard Attention
            attn_weights = torch.matmul(q, k.transpose(-2, -1)) * self.scale
            if attention_mask is not None:
                attn_weights = attn_weights + attention_mask
            else:
                # Causal Mask
                causal_mask = torch.triu(
                    torch.full((T, T), float('-inf'), device=x.device), diagonal=1
                )
                attn_weights = attn_weights + causal_mask
            attn_weights = F.softmax(attn_weights, dim=-1, dtype=torch.float32).to(q.dtype)
            if self.training and self.dropout > 0:
                attn_weights = F.dropout(attn_weights, p=self.dropout)
            attn_out = torch.matmul(attn_weights, v)

        # (B, heads, T, head_dim) → (B, T, hidden_size)
        attn_out = attn_out.transpose(1, 2).contiguous().view(B, T, -1)
        return self.o_proj(attn_out)


# ---------------------------------------------------------------------------
# SwiGLU Feed-Forward Network
# ---------------------------------------------------------------------------

class SwiGLUFFN(nn.Module):
    """
    SwiGLU: FFN(x) = (SiLU(gate(x)) * up(x)) @ down
    Effektive Hidden-Size wird auf 2/3 reduziert um Parameter-Anzahl zu halten.
    """
    def __init__(self, config: ModelConfig):
        super().__init__()
        # Auf nächste Vielfache von 256 runden für CUDA-Effizienz
        hidden = int(config.ffn_hidden_size * 2 / 3)
        hidden = ((hidden + 255) // 256) * 256

        self.gate_proj = nn.Linear(config.hidden_size, hidden, bias=False)
        self.up_proj   = nn.Linear(config.hidden_size, hidden, bias=False)
        self.down_proj = nn.Linear(hidden, config.hidden_size, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.down_proj(F.silu(self.gate_proj(x)) * self.up_proj(x))


# ---------------------------------------------------------------------------
# Transformer Block
# ---------------------------------------------------------------------------

class TransformerBlock(nn.Module):
    def __init__(self, config: ModelConfig):
        super().__init__()
        self.attn_norm = RMSNorm(config.hidden_size, eps=config.rms_norm_eps)
        self.attn = GroupedQueryAttention(config)
        self.ffn_norm = RMSNorm(config.hidden_size, eps=config.rms_norm_eps)
        self.ffn = SwiGLUFFN(config)
        self.dropout = nn.Dropout(config.dropout) if config.dropout > 0 else nn.Identity()

    def forward(
        self,
        x: torch.Tensor,
        freqs_cis: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        # Pre-Norm Architektur (stabiler als Post-Norm)
        x = x + self.dropout(self.attn(self.attn_norm(x), freqs_cis, attention_mask))
        x = x + self.dropout(self.ffn(self.ffn_norm(x)))
        return x


# ---------------------------------------------------------------------------
# Haupt-Modell
# ---------------------------------------------------------------------------

class CodeLM(nn.Module):
    def __init__(self, config: ModelConfig):
        super().__init__()
        self.config = config

        # Token Embedding
        self.embed_tokens = nn.Embedding(config.vocab_size, config.hidden_size, padding_idx=config.pad_token_id)

        # Transformer Layers
        self.layers = nn.ModuleList([TransformerBlock(config) for _ in range(config.num_layers)])

        # Final Norm
        self.norm = RMSNorm(config.hidden_size, eps=config.rms_norm_eps)

        # LM Head
        self.lm_head = nn.Linear(config.hidden_size, config.vocab_size, bias=False)

        # Embedding Tying
        if config.tie_embeddings:
            self.lm_head.weight = self.embed_tokens.weight

        # RoPE Frequenzen vorberechnen und als Buffer registrieren
        freqs = precompute_rope_freqs(config.head_dim, config.max_seq_len, config.rope_theta)
        self.register_buffer("freqs_cis", freqs, persistent=False)

        # Gewichte initialisieren
        self.apply(self._init_weights)
        # Spezielle Skalierung für Residual-Projektionen (GPT-2 Trick)
        for name, p in self.named_parameters():
            if name.endswith(("o_proj.weight", "down_proj.weight")):
                nn.init.normal_(p, mean=0.0, std=config.initializer_range / math.sqrt(2 * config.num_layers))

    def _init_weights(self, module: nn.Module):
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=self.config.initializer_range)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=self.config.initializer_range)
            if module.padding_idx is not None:
                module.weight.data[module.padding_idx].zero_()

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: Optional[torch.Tensor] = None,
        labels: Optional[torch.Tensor] = None,
    ) -> dict:
        """
        input_ids:      (batch, seq)
        attention_mask: (batch, seq) — 1 = real token, 0 = padding (optional)
        labels:         (batch, seq) — für Language Modeling Loss (optional)
        """
        B, T = input_ids.shape
        assert T <= self.config.max_seq_len, f"Sequenz zu lang: {T} > {self.config.max_seq_len}"

        # Token Embeddings
        x = self.embed_tokens(input_ids)

        # Attention Mask vorbereiten (für Padding)
        attn_mask = None
        if attention_mask is not None:
            # (B, 1, 1, T) für Broadcasting
            attn_mask = (1.0 - attention_mask.float()).unsqueeze(1).unsqueeze(2) * float('-inf')
            attn_mask = attn_mask.to(x.dtype)

        # Transformer Layers
        for layer in self.layers:
            x = layer(x, self.freqs_cis, attn_mask)

        # Final Norm
        x = self.norm(x)

        # LM Head → Logits
        logits = self.lm_head(x)

        # Loss berechnen (wenn Labels gegeben)
        loss = None
        if labels is not None:
            # Shift: Input[:-1] → Labels[1:]
            shift_logits = logits[..., :-1, :].contiguous()
            shift_labels = labels[..., 1:].contiguous()
            loss = F.cross_entropy(
                shift_logits.view(-1, self.config.vocab_size),
                shift_labels.view(-1),
                ignore_index=-100,  # -100 = ignorierte Tokens (Padding, FIM-Teile)
            )

        return {"loss": loss, "logits": logits}

    @torch.no_grad()
    def generate(
        self,
        input_ids: torch.Tensor,
        max_new_tokens: int = 256,
        temperature: float = 0.8,
        top_p: float = 0.95,
        top_k: int = 50,
        repetition_penalty: float = 1.1,
        eos_token_id: Optional[int] = None,
    ) -> torch.Tensor:
        """Einfache Autoregressive Generierung mit Top-p Sampling."""
        self.eval()
        eos_token_id = eos_token_id or self.config.eos_token_id
        generated = input_ids.clone()

        for _ in range(max_new_tokens):
            # Nur die letzten max_seq_len Tokens verwenden
            context = generated[:, -self.config.max_seq_len:]
            out = self.forward(context)
            logits = out["logits"][:, -1, :]  # Nur letzter Token

            # Repetition Penalty
            if repetition_penalty != 1.0:
                for token_id in set(generated[0].tolist()):
                    logits[0, token_id] /= repetition_penalty

            # Temperature
            logits = logits / temperature

            # Top-k
            if top_k > 0:
                top_k_vals = torch.topk(logits, top_k).values[:, -1, None]
                logits = logits.masked_fill(logits < top_k_vals, float('-inf'))

            # Top-p (Nucleus Sampling)
            if top_p < 1.0:
                sorted_logits, sorted_idx = torch.sort(logits, descending=True)
                cumulative_probs = torch.cumsum(F.softmax(sorted_logits, dim=-1), dim=-1)
                sorted_logits[cumulative_probs > top_p] = float('-inf')
                logits = torch.zeros_like(logits).scatter_(1, sorted_idx, sorted_logits)

            # Sampling
            probs = F.softmax(logits, dim=-1)
            next_token = torch.multinomial(probs, num_samples=1)
            generated = torch.cat([generated, next_token], dim=1)

            if next_token.item() == eos_token_id:
                break

        return generated

    def get_num_params(self, non_embedding: bool = True) -> int:
        n = sum(p.numel() for p in self.parameters())
        if non_embedding:
            n -= self.embed_tokens.weight.numel()
        return n


# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------

def create_model(config: Optional[ModelConfig] = None) -> CodeLM:
    """Erstellt ein neues Modell mit Standard-Konfiguration."""
    if config is None:
        config = ModelConfig()
    model = CodeLM(config)
    params = model.get_num_params()
    print(f"Modell erstellt: {params / 1e6:.1f}M Parameter")
    print(f"  Layers:        {config.num_layers}")
    print(f"  Hidden Size:   {config.hidden_size}")
    print(f"  Attn Heads:    {config.num_attention_heads} (KV: {config.num_kv_heads})")
    print(f"  Context:       {config.max_seq_len} tokens")
    return model


def load_model(checkpoint_path: str, device: str = "cuda") -> tuple[CodeLM, ModelConfig]:
    """Lädt ein gespeichertes Modell."""
    checkpoint = torch.load(checkpoint_path, map_location=device)
    config = checkpoint["config"]
    model = CodeLM(config).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    print(f"Modell geladen von {checkpoint_path} (Step {checkpoint.get('step', '?')})")
    return model, config


def estimate_vram(config: ModelConfig, batch_size: int = 4, seq_len: int = 1024) -> float:
    """Schätzt den VRAM-Bedarf in GB (bfloat16 Training)."""
    params = sum(
        config.vocab_size * config.hidden_size +  # Embeddings
        config.num_layers * (
            config.hidden_size ** 2 * 2 +  # Q, O
            config.hidden_size * config.num_kv_heads * config.head_dim * 2 +  # K, V
            config.hidden_size * int(config.ffn_hidden_size * 2 / 3) * 3  # FFN
        )
        for _ in [0]
    )
    weights_gb = params * 2 / 1e9          # bfloat16 = 2 bytes
    gradients_gb = weights_gb              # Gleich groß wie Gewichte
    optimizer_gb = params * 8 / 1e9       # AdamW: 2 Momentum-States × 4 bytes
    activations_gb = batch_size * seq_len * config.hidden_size * config.num_layers * 2 / 1e9
    total = weights_gb + gradients_gb + optimizer_gb + activations_gb
    print(f"VRAM-Schätzung (batch={batch_size}, seq={seq_len}):")
    print(f"  Gewichte:      {weights_gb:.2f} GB")
    print(f"  Gradienten:    {gradients_gb:.2f} GB")
    print(f"  Optimizer:     {optimizer_gb:.2f} GB")
    print(f"  Aktivierungen: {activations_gb:.2f} GB")
    print(f"  Gesamt:        {total:.2f} GB")
    return total


# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    config = ModelConfig()
    model = create_model(config)
    estimate_vram(config)

    # Schneller Forward-Pass Test
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device).to(torch.bfloat16)

    batch = torch.randint(0, config.vocab_size, (2, 512)).to(device)
    labels = batch.clone()

    with torch.autocast(device_type=device.split(":")[0], dtype=torch.bfloat16):
        out = model(batch, labels=labels)

    print(f"\nForward Pass OK")
    print(f"  Loss:   {out['loss'].item():.4f}")
    print(f"  Logits: {out['logits'].shape}")
