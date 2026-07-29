# Password Recovery Agent

Recovers forgotten passwords on **your own** encrypted Excel (`.xlsx`) and PDF files.

Targets in this run:
- `files/IFA_Modeling_Test_December_2023.xlsx` — OOXML AES-256 / SHA-512, spinCount 100000
- `files/Modeling_Test_Instructions_December_2023.pdf` — PDF AES-256 (V5/R6)

## Quick start

```bash
cd password-agent
chmod +x run.sh
./run.sh
```

Or call the Python agent directly:

```bash
python3 src/recover.py \
  --excel files/IFA_Modeling_Test_December_2023.xlsx \
  --pdf files/Modeling_Test_Instructions_December_2023.pdf \
  --wordlist wordlists/top100k.txt \
  --digits 6 \
  --workers 4 \
  --out-dir out
```

## Modes

| Flag | Purpose |
| --- | --- |
| `--inspect-only` | Print encryption parameters |
| `--export-hashes` | Write John-the-Ripper style hashes to `out/` |
| `--hint WORD` | Bias contextual candidates (repeatable) |
| `--wordlist PATH` | Dictionary attack (repeatable) |
| `--digits N` | Brute numeric passwords length 1..N |
| `--mask-max N` | Brute `[a-z0-9]` up to length N (expensive) |
| `--workers N` | Parallel processes (default 4) |

On success, decrypted copies are written to `out/decrypted_*`.

## Notes

- Excel Agile encryption (~100k SHA-512 iterations) is the bottleneck (~70 tries/sec on 4 cores here).
- PDF AES-256 R6 is faster to test (~850 tries/sec) but still hard for long random passwords.
- Strong unique passwords beyond the wordlists will not fall to this agent; you need the original password from the sender.
