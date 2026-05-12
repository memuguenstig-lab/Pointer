"""
Tokenizer Training für CodeLM
BPE Tokenizer mit 32.000 Tokens, optimiert für Code.

Verwendung:
    python tokenizer_train.py --data_dir ./data/raw --output_dir ./tokenizer
"""

import os
import re
import json
import argparse
from pathlib import Path
from typing import Iterator
from tokenizers import (
    Tokenizer,
    models,
    trainers,
    pre_tokenizers,
    decoders,
    processors,
    normalizers,
)
from tokenizers.implementations import ByteLevelBPETokenizer


# ---------------------------------------------------------------------------
# Spezielle Tokens
# ---------------------------------------------------------------------------

SPECIAL_TOKENS = [
    # Standard
    "<|pad|>",       # 0 - Padding
    "<|bos|>",       # 1 - Begin of Sequence
    "<|eos|>",       # 2 - End of Sequence
    "<|unk|>",       # 3 - Unknown

    # Fill-in-the-Middle (FIM) - wie in StarCoder
    "<|fim_prefix|>",   # 4 - FIM: Code vor dem Cursor
    "<|fim_suffix|>",   # 5 - FIM: Code nach dem Cursor
    "<|fim_middle|>",   # 6 - FIM: Hier generiert das Modell

    # Kontext-Marker
    "<|file_sep|>",     # 7 - Trennt verschiedene Dateien im Kontext
    "<|repo_name|>",    # 8 - Repository-Name
    "<|filename|>",     # 9 - Dateiname

    # Sprach-Marker (häufigste Sprachen)
    "<|lang:python|>",
    "<|lang:javascript|>",
    "<|lang:typescript|>",
    "<|lang:rust|>",
    "<|lang:go|>",
    "<|lang:java|>",
    "<|lang:cpp|>",
    "<|lang:c|>",
    "<|lang:csharp|>",
    "<|lang:html|>",
    "<|lang:css|>",
    "<|lang:sql|>",
    "<|lang:bash|>",
    "<|lang:markdown|>",
    "<|lang:json|>",
    "<|lang:yaml|>",
    "<|lang:toml|>",
    "<|lang:other|>",
]

# Mapping Dateiendung → Sprach-Token
EXTENSION_TO_LANG = {
    ".py": "<|lang:python|>",
    ".js": "<|lang:javascript|>",
    ".jsx": "<|lang:javascript|>",
    ".ts": "<|lang:typescript|>",
    ".tsx": "<|lang:typescript|>",
    ".rs": "<|lang:rust|>",
    ".go": "<|lang:go|>",
    ".java": "<|lang:java|>",
    ".cpp": "<|lang:cpp|>",
    ".cc": "<|lang:cpp|>",
    ".cxx": "<|lang:cpp|>",
    ".c": "<|lang:c|>",
    ".h": "<|lang:c|>",
    ".cs": "<|lang:csharp|>",
    ".html": "<|lang:html|>",
    ".htm": "<|lang:html|>",
    ".css": "<|lang:css|>",
    ".scss": "<|lang:css|>",
    ".sql": "<|lang:sql|>",
    ".sh": "<|lang:bash|>",
    ".bash": "<|lang:bash|>",
    ".md": "<|lang:markdown|>",
    ".json": "<|lang:json|>",
    ".yaml": "<|lang:yaml|>",
    ".yml": "<|lang:yaml|>",
    ".toml": "<|lang:toml|>",
}


# ---------------------------------------------------------------------------
# Daten-Iterator für Training
# ---------------------------------------------------------------------------

def iter_training_files(data_dir: str, max_files: int = None) -> Iterator[str]:
    """
    Iteriert über alle Code-Dateien im data_dir.
    Gibt den Inhalt jeder Datei als String zurück.
    """
    data_path = Path(data_dir)
    extensions = set(EXTENSION_TO_LANG.keys())
    count = 0

    for filepath in data_path.rglob("*"):
        if max_files and count >= max_files:
            break
        if not filepath.is_file():
            continue
        if filepath.suffix.lower() not in extensions:
            continue

        try:
            text = filepath.read_text(encoding="utf-8", errors="ignore")
            # Minimale Qualitätsfilter
            if len(text) < 50:
                continue
            if len(text) > 500_000:  # > 500KB überspringen
                continue
            yield text
            count += 1
        except Exception:
            continue

    print(f"Tokenizer-Training: {count} Dateien verarbeitet")


def iter_from_jsonl(jsonl_path: str, text_field: str = "content") -> Iterator[str]:
    """Liest Texte aus einer JSONL-Datei (z.B. The Stack v2 Format)."""
    with open(jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                obj = json.loads(line)
                text = obj.get(text_field, "")
                if text and len(text) > 50:
                    yield text
            except json.JSONDecodeError:
                continue


# ---------------------------------------------------------------------------
# Tokenizer Training
# ---------------------------------------------------------------------------

def train_tokenizer(
    data_dir: str,
    output_dir: str,
    vocab_size: int = 32000,
    min_frequency: int = 2,
    max_files: int = None,
) -> Tokenizer:
    """
    Trainiert einen BPE Tokenizer auf Code-Daten.

    Args:
        data_dir:      Verzeichnis mit Code-Dateien
        output_dir:    Ausgabe-Verzeichnis für den Tokenizer
        vocab_size:    Vokabular-Größe (Standard: 32.000)
        min_frequency: Minimale Häufigkeit für ein Token
        max_files:     Maximale Anzahl Dateien (None = alle)
    """
    os.makedirs(output_dir, exist_ok=True)

    print(f"Starte Tokenizer-Training...")
    print(f"  Vokabular-Größe: {vocab_size}")
    print(f"  Daten: {data_dir}")

    # BPE Tokenizer mit Byte-Level Pre-Tokenizer
    # Byte-Level bedeutet: kein <unk> Token nötig, alle Bytes sind abgedeckt
    tokenizer = Tokenizer(models.BPE(unk_token="<|unk|>"))

    # Pre-Tokenizer: ByteLevel (wie GPT-2)
    # add_prefix_space=False ist wichtig für Code (kein Leerzeichen am Anfang)
    tokenizer.pre_tokenizer = pre_tokenizers.ByteLevel(add_prefix_space=False)

    # Decoder
    tokenizer.decoder = decoders.ByteLevel()

    # Trainer konfigurieren
    trainer = trainers.BpeTrainer(
        vocab_size=vocab_size,
        min_frequency=min_frequency,
        special_tokens=SPECIAL_TOKENS,
        show_progress=True,
        # Initiales Alphabet: alle Bytes (0-255)
        initial_alphabet=pre_tokenizers.ByteLevel.alphabet(),
    )

    # Training starten
    print("Lese Trainingsdaten...")
    tokenizer.train_from_iterator(
        iter_training_files(data_dir, max_files=max_files),
        trainer=trainer,
        length=max_files,
    )

    # Post-Processor: BOS/EOS automatisch hinzufügen
    bos_id = tokenizer.token_to_id("<|bos|>")
    eos_id = tokenizer.token_to_id("<|eos|>")
    tokenizer.post_processor = processors.TemplateProcessing(
        single=f"<|bos|>:0 $A:0 <|eos|>:0",
        pair=f"<|bos|>:0 $A:0 <|eos|>:0 $B:0 <|eos|>:0",
        special_tokens=[
            ("<|bos|>", bos_id),
            ("<|eos|>", eos_id),
        ],
    )

    # Speichern
    tokenizer_path = os.path.join(output_dir, "tokenizer.json")
    tokenizer.save(tokenizer_path)
    print(f"Tokenizer gespeichert: {tokenizer_path}")

    # Konfiguration speichern
    config = {
        "vocab_size": vocab_size,
        "special_tokens": {tok: tokenizer.token_to_id(tok) for tok in SPECIAL_TOKENS},
        "extension_to_lang": EXTENSION_TO_LANG,
        "model_type": "bpe",
        "pre_tokenizer": "byte_level",
    }
    config_path = os.path.join(output_dir, "tokenizer_config.json")
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    print(f"Konfiguration gespeichert: {config_path}")

    return tokenizer


# ---------------------------------------------------------------------------
# Tokenizer Wrapper (für einfache Nutzung im Training)
# ---------------------------------------------------------------------------

class CodeTokenizer:
    """
    Wrapper um den trainierten Tokenizer.
    Bietet einfache Encode/Decode Methoden und FIM-Unterstützung.
    """

    def __init__(self, tokenizer_dir: str):
        tokenizer_path = os.path.join(tokenizer_dir, "tokenizer.json")
        self.tokenizer = Tokenizer.from_file(tokenizer_path)

        config_path = os.path.join(tokenizer_dir, "tokenizer_config.json")
        with open(config_path) as f:
            self.config = json.load(f)

        # Spezielle Token-IDs
        self.pad_id    = self.tokenizer.token_to_id("<|pad|>")
        self.bos_id    = self.tokenizer.token_to_id("<|bos|>")
        self.eos_id    = self.tokenizer.token_to_id("<|eos|>")
        self.fim_pre   = self.tokenizer.token_to_id("<|fim_prefix|>")
        self.fim_suf   = self.tokenizer.token_to_id("<|fim_suffix|>")
        self.fim_mid   = self.tokenizer.token_to_id("<|fim_middle|>")
        self.file_sep  = self.tokenizer.token_to_id("<|file_sep|>")

        self.vocab_size = self.tokenizer.get_vocab_size()

    def encode(self, text: str, add_special_tokens: bool = True) -> list[int]:
        """Enkodiert Text zu Token-IDs."""
        encoding = self.tokenizer.encode(text, add_special_tokens=add_special_tokens)
        return encoding.ids

    def decode(self, ids: list[int], skip_special_tokens: bool = True) -> str:
        """Dekodiert Token-IDs zu Text."""
        return self.tokenizer.decode(ids, skip_special_tokens=skip_special_tokens)

    def encode_file(self, content: str, filename: str = None) -> list[int]:
        """
        Enkodiert eine Datei mit optionalem Dateinamen-Header.
        Format: <|filename|> path/to/file.py \n <content> <|eos|>
        """
        tokens = [self.bos_id]
        if filename:
            lang_token = EXTENSION_TO_LANG.get(Path(filename).suffix.lower(), "<|lang:other|>")
            lang_id = self.tokenizer.token_to_id(lang_token)
            filename_id = self.tokenizer.token_to_id("<|filename|>")
            tokens.extend([lang_id, filename_id])
            tokens.extend(self.encode(filename + "\n", add_special_tokens=False))
        tokens.extend(self.encode(content, add_special_tokens=False))
        tokens.append(self.eos_id)
        return tokens

    def encode_fim(self, prefix: str, suffix: str) -> list[int]:
        """
        Enkodiert für Fill-in-the-Middle Training.
        Format: <fim_prefix> prefix <fim_suffix> suffix <fim_middle>
        Das Modell soll dann den mittleren Teil generieren.
        """
        tokens = [self.bos_id, self.fim_pre]
        tokens.extend(self.encode(prefix, add_special_tokens=False))
        tokens.append(self.fim_suf)
        tokens.extend(self.encode(suffix, add_special_tokens=False))
        tokens.append(self.fim_mid)
        return tokens

    def encode_chat(self, messages: list[dict]) -> list[int]:
        """
        Enkodiert eine Chat-Konversation.
        Format: <|bos|> [INST] user message [/INST] assistant response <|eos|>
        """
        tokens = [self.bos_id]
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == "user":
                text = f"[INST] {content} [/INST]"
            elif role == "assistant":
                text = f" {content} "
            elif role == "system":
                text = f"<<SYS>>\n{content}\n<</SYS>>\n\n"
            else:
                text = content
            tokens.extend(self.encode(text, add_special_tokens=False))
        tokens.append(self.eos_id)
        return tokens

    def batch_encode(self, texts: list[str], max_length: int = 1024, padding: bool = True) -> dict:
        """Enkodiert einen Batch von Texten mit Padding."""
        encodings = [self.encode(t) for t in texts]

        # Truncate
        encodings = [e[:max_length] for e in encodings]

        if not padding:
            return {"input_ids": encodings}

        # Pad auf gleiche Länge
        max_len = max(len(e) for e in encodings)
        attention_masks = []
        padded = []
        for enc in encodings:
            pad_len = max_len - len(enc)
            attention_masks.append([1] * len(enc) + [0] * pad_len)
            padded.append(enc + [self.pad_id] * pad_len)

        return {
            "input_ids": padded,
            "attention_mask": attention_masks,
        }

    def __len__(self) -> int:
        return self.vocab_size


# ---------------------------------------------------------------------------
# Statistiken
# ---------------------------------------------------------------------------

def analyze_tokenizer(tokenizer: CodeTokenizer, sample_texts: list[str] = None):
    """Gibt Statistiken über den Tokenizer aus."""
    print(f"\nTokenizer Statistiken:")
    print(f"  Vokabular-Größe: {tokenizer.vocab_size}")
    print(f"  Spezielle Tokens: {len(SPECIAL_TOKENS)}")

    if sample_texts is None:
        sample_texts = [
            "def fibonacci(n: int) -> int:\n    if n <= 1:\n        return n\n    return fibonacci(n-1) + fibonacci(n-2)",
            "const fetchData = async (url: string): Promise<Response> => {\n    const response = await fetch(url);\n    return response.json();\n};",
            "fn main() {\n    let numbers = vec![1, 2, 3, 4, 5];\n    let sum: i32 = numbers.iter().sum();\n    println!(\"Sum: {}\", sum);\n}",
        ]

    print(f"\nBeispiel-Tokenisierungen:")
    for text in sample_texts:
        ids = tokenizer.encode(text, add_special_tokens=False)
        chars_per_token = len(text) / len(ids) if ids else 0
        print(f"  Text ({len(text)} chars) → {len(ids)} tokens ({chars_per_token:.1f} chars/token)")
        print(f"  Erste 10 Tokens: {ids[:10]}")
        print(f"  Decoded: {tokenizer.decode(ids[:10])!r}")
        print()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="CodeLM Tokenizer Training")
    parser.add_argument("--data_dir", type=str, required=True, help="Verzeichnis mit Code-Dateien")
    parser.add_argument("--output_dir", type=str, default="./tokenizer", help="Ausgabe-Verzeichnis")
    parser.add_argument("--vocab_size", type=int, default=32000, help="Vokabular-Größe")
    parser.add_argument("--min_frequency", type=int, default=2, help="Minimale Token-Häufigkeit")
    parser.add_argument("--max_files", type=int, default=None, help="Max. Anzahl Dateien (für Tests)")
    parser.add_argument("--analyze", action="store_true", help="Tokenizer nach Training analysieren")
    args = parser.parse_args()

    # Training
    tokenizer_raw = train_tokenizer(
        data_dir=args.data_dir,
        output_dir=args.output_dir,
        vocab_size=args.vocab_size,
        min_frequency=args.min_frequency,
        max_files=args.max_files,
    )

    # Analyse
    if args.analyze:
        tokenizer = CodeTokenizer(args.output_dir)
        analyze_tokenizer(tokenizer)

    print("\nFertig! Tokenizer kann geladen werden mit:")
    print(f"  from tokenizer_train import CodeTokenizer")
    print(f"  tok = CodeTokenizer('{args.output_dir}')")


if __name__ == "__main__":
    main()
