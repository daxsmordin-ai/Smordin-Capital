#!/usr/bin/env python3
"""
Password Recovery Agent for encrypted Excel (OOXML AES-256) and PDF (AES-256) files.

Designed for recovering forgotten passwords on documents you own / are authorized
to access. Supports contextual candidates, dictionary attack, and short mask brute.
"""

from __future__ import annotations

import argparse
import io
import itertools
import json
import string
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable, Iterator, Optional

# Worker globals set via initializer (picklable path strings)
_XLSX_PATH: Optional[str] = None
_PDF_PATH: Optional[str] = None


def _init_workers(xlsx: Optional[str], pdf: Optional[str]) -> None:
    global _XLSX_PATH, _PDF_PATH
    _XLSX_PATH = xlsx
    _PDF_PATH = pdf


def try_excel_password(password: str) -> Optional[str]:
    import msoffcrypto

    if not _XLSX_PATH:
        return None
    with open(_XLSX_PATH, "rb") as fh:
        office = msoffcrypto.OfficeFile(fh)
        try:
            office.load_key(password=password)
            out = io.BytesIO()
            office.decrypt(out)
            return password
        except Exception:
            return None


def try_pdf_password(password: str) -> Optional[str]:
    import pikepdf

    if not _PDF_PATH:
        return None
    try:
        with pikepdf.open(_PDF_PATH, password=password):
            return password
    except Exception:
        return None


def try_both(password: str) -> tuple[str, Optional[str], Optional[str]]:
    return password, try_excel_password(password), try_pdf_password(password)


@dataclass
class FileStatus:
    path: str
    encrypted: bool
    kind: str
    details: dict = field(default_factory=dict)


@dataclass
class RecoveryResult:
    excel_password: Optional[str] = None
    pdf_password: Optional[str] = None
    attempts: int = 0
    elapsed_sec: float = 0.0
    stopped_reason: str = ""


def inspect_excel(path: Path) -> FileStatus:
    import msoffcrypto

    details: dict = {}
    encrypted = False
    try:
        with open(path, "rb") as fh:
            office = msoffcrypto.OfficeFile(fh)
            encrypted = bool(office.is_encrypted())
            details["type"] = type(office).__name__
        raw = path.read_bytes()
        marker = b'spinCount="'
        idx = raw.find(marker)
        if idx >= 0:
            end = raw.find(b'"', idx + len(marker))
            details["spinCount"] = raw[idx + len(marker) : end].decode("ascii", "ignore")
        for key in (b'cipherAlgorithm="', b'hashAlgorithm="', b'keyBits="'):
            i = raw.find(key)
            if i >= 0:
                j = raw.find(b'"', i + len(key))
                details[key.decode().rstrip('="')] = raw[i + len(key) : j].decode(
                    "ascii", "ignore"
                )
    except Exception as exc:
        details["error"] = str(exc)
    return FileStatus(str(path), encrypted, "excel", details)


def inspect_pdf(path: Path) -> FileStatus:
    from pypdf import PdfReader
    import pikepdf

    details: dict = {}
    encrypted = False
    try:
        reader = PdfReader(str(path))
        encrypted = bool(reader.is_encrypted)
        details["pypdf_encrypted"] = encrypted
        try:
            with pikepdf.open(path):
                details["opens_without_password"] = True
                encrypted = False
        except pikepdf.PasswordError:
            details["opens_without_password"] = False
            encrypted = True
        raw = path.read_bytes()
        for label, needle in (
            ("V", b"/V "),
            ("R", b"/R "),
            ("CFM", b"/CFM/"),
            ("Length", b"/Length "),
        ):
            i = raw.find(needle)
            if i >= 0:
                snippet = raw[i : i + 24]
                details[label] = snippet.decode("latin-1", "replace").split()[0]
    except Exception as exc:
        details["error"] = str(exc)
    return FileStatus(str(path), encrypted, "pdf", details)


def contextual_candidates(hints: list[str]) -> list[str]:
    """Build a high-signal candidate list from filename / user hints."""
    seeds = [h.strip() for h in hints if h and h.strip()]
    base = [
        "",
        "password",
        "Password",
        "PASSWORD",
        "Password1",
        "password1",
        "Password123",
        "password123",
        "Passw0rd",
        "P@ssw0rd",
        "1234",
        "12345",
        "123456",
        "12345678",
        "qwerty",
        "admin",
        "welcome",
        "secret",
        "confidential",
        "private",
        "readonly",
        "ReadOnly",
        "open",
        "unlock",
        "excel",
        "Excel",
        "pdf",
        "PDF",
        "adobe",
        "Adobe",
        "test",
        "Test",
        "TEST",
        "model",
        "Model",
        "modeling",
        "Modeling",
        "modelling",
        "Modelling",
        "instructions",
        "Instructions",
        "interview",
        "Interview",
        "assessment",
        "Assessment",
        "case",
        "Case",
        "finance",
        "Finance",
        "2023",
        "December",
        "december",
        "Dec2023",
        "dec2023",
        "December2023",
        "December 2023",
        "122023",
        "12/2023",
    ]
    # Expand seeds into common password shapes
    shaped: list[str] = []
    for s in seeds:
        variants = {
            s,
            s.lower(),
            s.upper(),
            s.title(),
            s.replace(" ", ""),
            s.replace(" ", "_"),
            s.replace(" ", "-"),
            s.replace(" ", "").lower(),
            s.replace("_", ""),
            s.replace("-", ""),
        }
        shaped.extend(variants)
        for v in list(variants):
            for suffix in ("", "1", "12", "123", "!", "@", "#", "2023", "23", "1234"):
                shaped.append(v + suffix)
            for prefix in ("", "IFA", "ifa"):
                if not v.lower().startswith(prefix.lower()) or not prefix:
                    shaped.append(prefix + v)

    # IFA modeling defaults
    ifa = [
        "ifa",
        "IFA",
        "Ifa",
        "IFA2023",
        "ifa2023",
        "IFA123",
        "ifa123",
        "IFA!",
        "IFA@",
        "IFA#",
        "IFAModeling",
        "ifaModeling",
        "IFA_Modeling",
        "ifa_modeling",
        "IFA-Modeling",
        "ModelingTest",
        "modelingtest",
        "Modeling_Test",
        "ModelingTest2023",
        "IFAModelingTest",
        "IFAModelingTest2023",
        "ifa_modeling_test",
        "IFA Modeling",
        "IFA Modeling Test",
        "Modeling Test",
        "IFA Modeling Test December 2023",
    ]
    out = list(dict.fromkeys(base + ifa + shaped))
    return out


def load_wordlist(path: Path, limit: Optional[int] = None) -> Iterator[str]:
    count = 0
    with open(path, "r", encoding="utf-8", errors="ignore") as fh:
        for line in fh:
            pw = line.rstrip("\n\r")
            if not pw:
                continue
            yield pw
            count += 1
            if limit is not None and count >= limit:
                break


def mask_candidates(
    charset: str,
    min_len: int,
    max_len: int,
    limit: Optional[int] = None,
) -> Iterator[str]:
    count = 0
    for length in range(min_len, max_len + 1):
        for combo in itertools.product(charset, repeat=length):
            yield "".join(combo)
            count += 1
            if limit is not None and count >= limit:
                return


def chunked(iterable: Iterable[str], size: int) -> Iterator[list[str]]:
    batch: list[str] = []
    for item in iterable:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def run_attack(
    excel: Optional[Path],
    pdf: Optional[Path],
    passwords: Iterable[str],
    workers: int,
    progress_every: int = 500,
) -> RecoveryResult:
    result = RecoveryResult()
    need_excel = excel is not None
    need_pdf = pdf is not None
    t0 = time.time()

    xlsx_s = str(excel) if excel else None
    pdf_s = str(pdf) if pdf else None

    with ProcessPoolExecutor(
        max_workers=workers, initializer=_init_workers, initargs=(xlsx_s, pdf_s)
    ) as pool:
        for batch in chunked(passwords, max(workers * 8, 32)):
            futures = [pool.submit(try_both, pw) for pw in batch]
            for fut in as_completed(futures):
                pw, excel_hit, pdf_hit = fut.result()
                result.attempts += 1
                if need_excel and result.excel_password is None and excel_hit is not None:
                    result.excel_password = excel_hit
                    print(f"[HIT] Excel password: {excel_hit!r}", flush=True)
                if need_pdf and result.pdf_password is None and pdf_hit is not None:
                    result.pdf_password = pdf_hit
                    print(f"[HIT] PDF password: {pdf_hit!r}", flush=True)
                if progress_every and result.attempts % progress_every == 0:
                    elapsed = time.time() - t0
                    rate = result.attempts / elapsed if elapsed else 0
                    print(
                        f"[...] tried={result.attempts} rate={rate:.1f}/s "
                        f"excel={result.excel_password!r} pdf={result.pdf_password!r}",
                        flush=True,
                    )
                excel_done = (not need_excel) or result.excel_password is not None
                pdf_done = (not need_pdf) or result.pdf_password is not None
                if excel_done and pdf_done:
                    for f in futures:
                        f.cancel()
                    result.stopped_reason = "both_found"
                    result.elapsed_sec = time.time() - t0
                    return result

    result.elapsed_sec = time.time() - t0
    result.stopped_reason = "wordlist_exhausted"
    return result


def decrypt_excel(src: Path, password: str, dest: Path) -> None:
    import msoffcrypto

    with open(src, "rb") as fh:
        office = msoffcrypto.OfficeFile(fh)
        office.load_key(password=password)
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as out:
            office.decrypt(out)


def decrypt_pdf(src: Path, password: str, dest: Path) -> None:
    import pikepdf

    dest.parent.mkdir(parents=True, exist_ok=True)
    with pikepdf.open(src, password=password) as doc:
        doc.save(dest)


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Recover passwords for encrypted Excel/PDF documents you are authorized to access."
    )
    p.add_argument("--excel", type=Path, help="Path to encrypted .xlsx")
    p.add_argument("--pdf", type=Path, help="Path to encrypted .pdf")
    p.add_argument(
        "--wordlist",
        type=Path,
        action="append",
        default=[],
        help="Password wordlist (repeatable)",
    )
    p.add_argument(
        "--hint",
        action="append",
        default=[],
        help="Contextual hint words from filename/email (repeatable)",
    )
    p.add_argument(
        "--skip-contextual",
        action="store_true",
        help="Skip built-in contextual candidate pass",
    )
    p.add_argument(
        "--digits",
        type=int,
        metavar="N",
        help="Also brute-force numeric passwords of length 1..N",
    )
    p.add_argument(
        "--mask-max",
        type=int,
        default=0,
        help="Brute lowercase+digits masks up to this length (expensive)",
    )
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--limit", type=int, help="Max candidates to try")
    p.add_argument("--out-dir", type=Path, default=Path("out"))
    p.add_argument(
        "--inspect-only",
        action="store_true",
        help="Only print encryption details",
    )
    p.add_argument(
        "--export-hashes",
        action="store_true",
        help="Write john-format hashes when helper scripts are available",
    )
    return p


def maybe_export_hashes(excel: Optional[Path], pdf: Optional[Path], out_dir: Path) -> None:
    import subprocess

    out_dir.mkdir(parents=True, exist_ok=True)
    john_run = Path("/tmp/john/run")
    if excel and (john_run / "office2john.py").exists():
        proc = subprocess.run(
            [sys.executable, str(john_run / "office2john.py"), str(excel)],
            capture_output=True,
            text=True,
        )
        (out_dir / "excel.hash").write_text(proc.stdout or proc.stderr)
        print(f"Wrote {out_dir / 'excel.hash'}")
    if pdf and (john_run / "pdf2john.py").exists():
        proc = subprocess.run(
            [sys.executable, str(john_run / "pdf2john.py"), str(pdf)],
            capture_output=True,
            text=True,
        )
        (out_dir / "pdf.hash").write_text(proc.stdout or proc.stderr)
        print(f"Wrote {out_dir / 'pdf.hash'}")


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.excel and not args.pdf:
        print("Provide --excel and/or --pdf", file=sys.stderr)
        return 2

    report: dict = {"files": [], "result": None}

    if args.excel:
        status = inspect_excel(args.excel)
        report["files"].append(asdict(status))
        print(json.dumps(asdict(status), indent=2))
    if args.pdf:
        status = inspect_pdf(args.pdf)
        report["files"].append(asdict(status))
        print(json.dumps(asdict(status), indent=2))

    if args.export_hashes:
        maybe_export_hashes(args.excel, args.pdf, args.out_dir)

    if args.inspect_only:
        args.out_dir.mkdir(parents=True, exist_ok=True)
        (args.out_dir / "inspect.json").write_text(json.dumps(report, indent=2))
        return 0

    # Build candidate stream
    streams: list[Iterable[str]] = []
    if not args.skip_contextual:
        hints = list(args.hint)
        for path in (args.excel, args.pdf):
            if path:
                hints.append(path.stem)
                hints.extend(path.stem.replace("__", " ").replace("_", " ").split())
        streams.append(contextual_candidates(hints))

    for wl in args.wordlist:
        streams.append(load_wordlist(wl, limit=None))

    if args.digits:
        streams.append(mask_candidates(string.digits, 1, args.digits))

    if args.mask_max and args.mask_max > 0:
        streams.append(
            mask_candidates(string.ascii_lowercase + string.digits, 1, args.mask_max)
        )

    def merged() -> Iterator[str]:
        seen: set[str] = set()
        count = 0
        for stream in streams:
            for pw in stream:
                if pw in seen:
                    continue
                seen.add(pw)
                yield pw
                count += 1
                if args.limit is not None and count >= args.limit:
                    return

    print(
        f"Starting recovery workers={args.workers} "
        f"excel={args.excel} pdf={args.pdf}",
        flush=True,
    )
    result = run_attack(
        excel=args.excel if args.excel else None,
        pdf=args.pdf if args.pdf else None,
        passwords=merged(),
        workers=args.workers,
    )
    report["result"] = asdict(result)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    (args.out_dir / "result.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(asdict(result), indent=2))

    if result.excel_password and args.excel:
        dest = args.out_dir / f"decrypted_{args.excel.name}"
        decrypt_excel(args.excel, result.excel_password, dest)
        print(f"Wrote decrypted Excel -> {dest}")
    if result.pdf_password and args.pdf:
        dest = args.out_dir / f"decrypted_{args.pdf.name}"
        decrypt_pdf(args.pdf, result.pdf_password, dest)
        print(f"Wrote decrypted PDF -> {dest}")

    both_ok = True
    if args.excel and not result.excel_password:
        both_ok = False
    if args.pdf and not result.pdf_password:
        both_ok = False
    return 0 if both_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
