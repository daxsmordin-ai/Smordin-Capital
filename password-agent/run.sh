#!/usr/bin/env bash
# Password recovery agent runner for IFA Modeling Test files.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
export PATH="$HOME/.local/bin:$PATH"

EXCEL="${EXCEL:-$ROOT/files/IFA_Modeling_Test_December_2023.xlsx}"
PDF="${PDF:-$ROOT/files/Modeling_Test_Instructions_December_2023.pdf}"
WORKERS="${WORKERS:-4}"
OUT="${OUT:-$ROOT/out}"

python3 -m pip install --user -q -r "$ROOT/requirements.txt"

echo "== Inspect =="
python3 "$ROOT/src/recover.py" \
  --excel "$EXCEL" \
  --pdf "$PDF" \
  --out-dir "$OUT" \
  --export-hashes \
  --inspect-only

echo "== Recover (contextual + wordlists + digits) =="
python3 "$ROOT/src/recover.py" \
  --excel "$EXCEL" \
  --pdf "$PDF" \
  --out-dir "$OUT" \
  --workers "$WORKERS" \
  --hint "IFA" \
  --hint "Modeling Test" \
  --hint "December 2023" \
  --hint "Smordin" \
  --hint "Smordin Capital" \
  --wordlist "$ROOT/wordlists/common.txt" \
  --wordlist "$ROOT/wordlists/top100k.txt" \
  --digits 6 \
  "$@"
