# Plan: Eigenes Coding-fokussiertes AI Modell

## Ziel
Ein kleines, schnelles Language Model das:
- **Lokal läuft** (kein Cloud-Zugriff nötig)
- **Coding-fokussiert** ist (Code-Completion, Erklärungen, Debugging)
- **Ressourcenschonend** ist (läuft auf normaler Consumer-Hardware)
- **Wirklich auf Code trainiert** ist (nicht nur fine-getuned)

---

## 1. Architektur-Entscheidung

### Modell-Typ: Decoder-only Transformer (GPT-Style)
Begründung: Bewährt für Code-Generierung, gut skalierbar, einfacher zu trainieren als Encoder-Decoder für diesen Use-Case.

### Hardware: RTX 4070 Ti (12GB VRAM)
| Größe | VRAM (Training) | Trainingszeit (lokal) | Qualität |
|-------|----------------|----------------------|---------|
| 350M  | ~10 GB         | 2–3 Wochen           | Solide  |
| 1B    | >24 GB*        | Nicht praktikabel    | —       |

*1B nur mit CPU-Offloading möglich, aber ~10x langsamer — nicht empfohlen.

**Zielgröße: 350M Parameter** — passt in 12GB VRAM, trainierbar in vernünftiger Zeit.

> **Cloud-Option:** Für 1B Parameter kurz auf RunPod (4x A100, ~$10/h) hochskalieren.
> Kosten: ~$800–1.200 für komplettes Pre-Training (~4-5 Tage).

### Architektur-Details (350M)
```
- Layers:          24
- Hidden Size:     1024
- Attention Heads: 16
- KV Heads:        8  (Grouped Query Attention, spart VRAM)
- FFN Size:        4096 (SwiGLU → effektiv 2730)
- Context Length:  4096 tokens
- Aktivierung:     SwiGLU
- Positional Enc.: RoPE (Rotary Position Embedding)
- Normalisierung:  RMSNorm
- Parameter:       ~350M
```

### VRAM-Kalkulation (Training, bfloat16)
```
Modell-Gewichte:      350M × 2 bytes = 0.7 GB
Gradienten:           350M × 2 bytes = 0.7 GB
Optimizer (AdamW):    350M × 8 bytes = 2.8 GB
Aktivierungen:        ~4–5 GB (batch-abhängig)
Gesamt:               ~8–9 GB  ✓ passt in 12GB
```

---

## 2. Tokenizer

### Typ: BPE (Byte-Pair Encoding)
- Vokabular-Größe: **32.000 tokens**
- Speziell trainiert auf Code-Korpora
- Wichtige Sonderzeichen werden als eigene Tokens behandelt:
  - Einrückungen (`    `, `\t`)
  - Klammern, Operatoren (`{`, `}`, `=>`, `::`, `->`)
  - Häufige Keywords pro Sprache

### Tool: SentencePiece oder tiktoken-kompatibel

---

## 3. Trainingsdaten

### Phase 1: Pre-Training (Basis-Wissen)
Ziel: Das Modell lernt Syntax, Semantik und Muster von Code.

Für 350M Parameter braucht man ~50B Tokens (Chinchilla-optimal).

| Datensatz | Gefilterte Größe | Tokens (geschätzt) | Inhalt |
|-----------|-----------------|-------------------|--------|
| [The Stack v2](https://huggingface.co/datasets/bigcode/the-stack-v2) (Top-10 Sprachen) | ~30 GB | ~25B | 600+ Programmiersprachen |
| [StarCoder Data](https://huggingface.co/datasets/bigcode/starcoderdata) | ~15 GB | ~12B | Hochqualitativ gefiltert |
| Dokumentationen | ~5 GB | ~4B | Python Docs, MDN, Rust Book, etc. |
| StackOverflow (Code-Posts) | ~8 GB | ~6B | Q&A zu Code-Problemen |
| **Gesamt** | **~58 GB** | **~47B** | |

**Gefilterte Gesamtgröße: ~58GB** — passt auf eine 500GB NVMe SSD.

#### Qualitätsfilter:
- Entferne Dateien < 100 Zeichen oder > 1MB
- Entferne Dateien mit > 30% nicht-ASCII
- Deduplizierung (MinHash LSH)
- Lizenz-Filter (nur permissive Lizenzen: MIT, Apache, BSD)

### Phase 2: Instruction Fine-Tuning (SFT)
Ziel: Das Modell lernt auf Anweisungen zu reagieren.

| Datensatz | Größe | Inhalt |
|-----------|-------|--------|
| [CodeAlpaca](https://huggingface.co/datasets/sahil2801/CodeAlpaca-20k) | 20K | Code-Instruktionen |
| [Evol-Instruct-Code](https://huggingface.co/datasets/nickrosh/Evol-Instruct-Code-80k-v1) | 80K | Komplexe Code-Aufgaben |
| [OSS-Instruct](https://huggingface.co/datasets/ise-uiuc/Magicoder-OSS-Instruct-75K) | 75K | Aus echtem Code generiert |
| Selbst-generierte Daten | ~50K | Synthetisch mit GPT-4 erstellt |

### Phase 3: RLHF / DPO (Optional aber empfohlen)
- DPO (Direct Preference Optimization) statt klassischem RLHF
- Einfacher zu implementieren, ähnliche Qualität
- Daten: Paare von guten/schlechten Code-Antworten

---

## 4. Training-Setup

### Hardware: RTX 4070 Ti (12GB VRAM)
```
GPU:       RTX 4070 Ti — 12GB VRAM, 7680 CUDA Cores
RAM:       ≥32 GB System-RAM empfohlen (für Datenpipeline)
SSD:       ≥500 GB NVMe (Datensätze + Checkpoints)
Zeit:      ~2–3 Wochen für 350M Modell (durchgehend)
```

### Cloud-Option für 1B (optional)
```
Anbieter:  RunPod / Lambda Labs
Setup:     4x A100 80GB
Kosten:    ~$800–1.200 (4–5 Tage Training)
Vorteil:   Gleicher Code, nur andere Konfiguration
```

### Framework: PyTorch + HuggingFace Transformers
```
torch >= 2.1
transformers >= 4.36
accelerate >= 0.25      # GPU-Optimierungen
flash-attn >= 2.4       # Flash Attention 2 (2-4x schneller, spart VRAM)
datasets >= 2.14
tokenizers >= 0.15
wandb                   # Training-Monitoring
```

### Training-Konfiguration (350M, RTX 4070 Ti)
```yaml
# Pre-Training
sequence_length:    1024          # Kleiner als 4096 wegen VRAM
micro_batch_size:   4             # Pro GPU-Step
gradient_accumulation: 64        # Effektive Batch-Size = 4×64 = 256 Sequenzen
global_tokens_per_step: ~262K    # 256 × 1024
learning_rate:      3e-4
lr_schedule:        cosine decay
warmup_steps:       1000
max_steps:          200000        # ~50B tokens gesamt
optimizer:          AdamW (beta1=0.9, beta2=0.95)
weight_decay:       0.1
gradient_clipping:  1.0
precision:          bfloat16
flash_attention:    true          # Pflicht für 12GB VRAM

# Fine-Tuning (SFT)
learning_rate:      2e-5
epochs:             3
micro_batch_size:   2
gradient_accumulation: 16
```

### Tokens gesamt
```
200.000 steps × 262.144 tokens = ~52 Milliarden Tokens
Entspricht ~40GB Code-Text — ausreichend für 350M Modell
```

---

## 5. Spezielle Code-Features

### Fill-in-the-Middle (FIM)
Ermöglicht Code-Completion in der Mitte einer Datei (wie GitHub Copilot).
```
Format:
<|fim_prefix|> ... code before cursor ...
<|fim_suffix|> ... code after cursor ...
<|fim_middle|> [MODELL GENERIERT HIER]
```

### Spezielle Tokens
```
<|code|>        - Code-Block Start
<|endcode|>     - Code-Block Ende
<|lang:python|> - Sprach-Marker
<|fim_prefix|>  - FIM Prefix
<|fim_suffix|>  - FIM Suffix
<|fim_middle|>  - FIM Middle
<|comment|>     - Kommentar-Kontext
<|docstring|>   - Docstring-Kontext
```

### Unterstützte Sprachen (Priorität)
1. Python, JavaScript/TypeScript, Rust
2. Go, Java, C/C++, C#
3. HTML/CSS, SQL, Bash
4. Ruby, PHP, Kotlin, Swift

---

## 6. Quantisierung (für lokale Nutzung)

Nach dem Training wird das Modell quantisiert um es auf Consumer-Hardware laufen zu lassen:

| Format | Größe (1B) | RAM | Qualitätsverlust |
|--------|-----------|-----|-----------------|
| FP16   | ~2 GB     | 4GB | Keiner          |
| GGUF Q8| ~1.1 GB   | 2GB | Minimal         |
| GGUF Q4| ~0.6 GB   | 1GB | Gering          |

**Empfehlung: GGUF Q8** für beste Qualität bei akzeptabler Größe.

### Tools für Quantisierung:
- `llama.cpp` (GGUF Format, läuft auf CPU+GPU)
- `bitsandbytes` (4-bit/8-bit für Python)
- `ONNX Runtime` (für plattformübergreifende Nutzung)

---

## 7. Inference & Integration

### Lokaler Server: llama.cpp oder Ollama
```bash
# Mit Ollama (einfachste Option)
ollama serve
ollama run coding-model

# Mit llama.cpp
./server -m coding-model-q8.gguf -c 4096 --port 8080
```

### API-Kompatibilität: OpenAI-kompatible API
Das Modell soll eine OpenAI-kompatible REST API bereitstellen, damit es direkt in die bestehende App integriert werden kann.

```
POST /v1/completions
POST /v1/chat/completions
POST /v1/fim/completions  (custom, für Code-Completion)
```

---

## 8. Evaluation & Benchmarks

### Ziel-Benchmarks
| Benchmark | Beschreibung | Zielwert (350M) |
|-----------|-------------|----------------|
| HumanEval | Python Code-Generierung | > 25% pass@1 |
| MBPP | Python Programmieraufgaben | > 35% |
| MultiPL-E | Multi-Sprachen Eval | > 20% |
| CRUXEval | Code Reasoning | > 20% |

### Vergleich mit existierenden Modellen
```
Ziel: Vergleichbar mit CodeGen-350M, besser durch Code-spezifischen Tokenizer + FIM
Referenz: GPT-2 Small (117M) schafft ~0% HumanEval — 350M mit Code-Training ~25%
```

---

## 9. Implementierungs-Roadmap

### Phase 1: Vorbereitung (Woche 1-2)
- [ ] Tokenizer trainieren auf Code-Daten
- [ ] Datenpipeline aufsetzen (Download, Filter, Deduplizierung)
- [ ] Modell-Architektur implementieren (PyTorch)
- [ ] Training-Infrastruktur aufsetzen

### Phase 2: Pre-Training (Woche 3-6)
- [ ] Pre-Training auf ~100GB Code-Daten
- [ ] Checkpoints alle 10K Steps speichern
- [ ] Loss-Kurven monitoren (Weights & Biases)
- [ ] Zwischen-Evaluierungen auf HumanEval

### Phase 3: Fine-Tuning (Woche 7-8)
- [ ] SFT auf Instruction-Daten
- [ ] DPO Training (optional)
- [ ] Chat-Template implementieren

### Phase 4: Deployment (Woche 9)
- [ ] Quantisierung (GGUF Q8 + Q4)
- [ ] Ollama Modelfile erstellen
- [ ] Integration in die App testen
- [ ] Dokumentation

---

## 10. Alternativer Ansatz: Fine-Tuning eines Basis-Modells

Falls eigenes Pre-Training zu aufwändig ist, kann man ein bestehendes Basis-Modell nehmen und es auf Code spezialisieren:

### Empfohlene Basis-Modelle
| Modell | Größe | Lizenz | Eignung |
|--------|-------|--------|---------|
| [Qwen2.5-1.5B](https://huggingface.co/Qwen/Qwen2.5-1.5B) | 1.5B | Apache 2.0 | ⭐⭐⭐⭐⭐ |
| [Phi-3.5-mini](https://huggingface.co/microsoft/Phi-3.5-mini-instruct) | 3.8B | MIT | ⭐⭐⭐⭐ |
| [SmolLM2-1.7B](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B) | 1.7B | Apache 2.0 | ⭐⭐⭐⭐ |

**Fine-Tuning mit LoRA/QLoRA** (viel ressourcenschonender):
```
GPU:  1x RTX 4090 (24GB)
Zeit: 2-3 Tage
Kosten: ~$50-100 Cloud-Compute
```

---

## 11. Empfehlung

**Mit RTX 4070 Ti (12GB VRAM) von Grund auf:**

**Stufe 1 — Lokal (350M, ~2-3 Wochen):**
→ 350M Modell komplett lokal trainieren. Gute Qualität, passt perfekt in 12GB VRAM.
→ Danach: GGUF Q8 (~700MB), läuft mit <1GB RAM zur Inference-Zeit.

**Stufe 2 — Cloud-Upgrade (1B, optional):**
→ Gleicher Code, gleiche Daten, nur auf RunPod 4x A100 hochskalieren.
→ ~$1.000 für ein deutlich stärkeres Modell.

**Empfohlener Start:**
1. Tokenizer trainieren (lokal, ~2h)
2. Datenpipeline aufsetzen (lokal, ~1 Tag)
3. Kleinen Smoke-Test mit 10M Tokens (lokal, ~1h)
4. Volles Pre-Training starten (lokal, 2-3 Wochen)
5. SFT Fine-Tuning (lokal, ~2-3 Tage)
6. Quantisieren + in App integrieren

---

## Ressourcen & Referenzen

- [The Stack v2 Dataset](https://huggingface.co/datasets/bigcode/the-stack-v2)
- [StarCoder2 Paper](https://arxiv.org/abs/2402.19173) — Architektur-Referenz
- [Phi-2 Technical Report](https://arxiv.org/abs/2309.05463) — Kleine Modelle, große Qualität
- [llama.cpp](https://github.com/ggerganov/llama.cpp) — Lokale Inference
- [Ollama](https://ollama.ai) — Einfaches lokales Deployment
- [LitGPT](https://github.com/Lightning-AI/litgpt) — Saubere Training-Implementierung
- [TRL Library](https://github.com/huggingface/trl) — SFT + DPO Training
