r"""
Check the pieces before involving the phone.

Runs OCR over a real receipt and prints the rows, then asks the model to
translate a few names. If this passes, the app has nothing left to break.

    .venv\Scripts\activate
    python smoke_test.py "..\..\uploads\WhatsApp Image 2026-08-30 at 06.58.33.jpeg"
"""

import asyncio
import base64
import sys
import time
from pathlib import Path

import server

# The Windows console is cp1252 and cannot print Japanese; without this the
# script dies on its own output after the work has already succeeded.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass

REPORT = Path("smoke_report.txt")
_lines: list[str] = []


def say(text: str = "") -> None:
    _lines.append(text)
    print(text)


async def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "receipt.jpg")
    if not path.exists():
        print(f"No such file: {path}")
        raise SystemExit(1)

    say(f"Reading {path.name} ...")
    started = time.time()
    data = base64.b64encode(path.read_bytes()).decode()
    result = server.read(server.ReadRequest(image=data), x_spendly_key=None)
    rows = result["lines"]
    print(f"  {result['engine']} returned {len(rows)} rows in {time.time() - started:.1f}s\n")
    for r in rows[:40]:
        say(f"    {r}")
    if len(rows) > 40:
        say(f"    ... {len(rows) - 40} more")

    names = [r for r in rows if any("\u3040" <= c <= "\u30ff" or "\u4e00" <= c <= "\u9fff" for c in r)][:8]
    if not names:
        print("\nNo Japanese lines found to translate.")
        return

    print(f"\nTranslating {len(names)} names with {server.MODEL} ...")
    started = time.time()
    out = await server.translate(server.TranslateRequest(names=names), x_spendly_key=None)
    print(f"  done in {time.time() - started:.1f}s (parsed={out.get('parsed')})\n")
    for before, after in zip(names, out["translations"]):
        say(f"    {before}")
        say(f"      -> {after}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    finally:
        REPORT.write_text(chr(10).join(_lines), encoding="utf-8")
        print("report written to " + str(REPORT))
