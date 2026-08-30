"""
Spendly's local service: read receipts and translate them, with no quota.

Three endpoints, all optional to the app — it falls back to the cloud and then
to the phone when this is not running.

  POST /read       receipt photo  -> lines of text        (PaddleOCR)
  POST /extract    lines of text  -> structured items     (Qwen, fallback only)
  POST /translate  Japanese names -> English              (Qwen)

The phone keeps parsing and classification. Those are tested against real
receipts and get 20 of 20 items on a 業務スーパー bill, so there is one copy of
the receipt rules rather than two that drift apart. /extract exists for the
layouts those rules have never seen.

Run:
    .venv\\Scripts\\activate
    python -m uvicorn server:app --host 0.0.0.0 --port 8756
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
from typing import Any

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

# A tunnel is a public address. Without this, the difference between "my phone
# can reach my laptop" and "anyone can" is that nobody has guessed the URL yet.
SHARED_SECRET = os.environ.get("SPENDLY_KEY", "")
OLLAMA = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("SPENDLY_MODEL", "qwen3:4b")

app = FastAPI(title="Spendly local service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

_ocr = None
_ocr_api = "unknown"


def ocr():
    """
    Load PaddleOCR once, tolerating both major versions.

    3.x dropped `use_angle_cls` and `show_log` from the constructor and replaced
    `.ocr()` with `.predict()`. Trying the new signature first and falling back
    keeps this working across an upgrade rather than failing on a keyword.

    Left on CPU deliberately: a 4GB card is already mostly spent on Qwen, and
    OCR on CPU takes a second or two, which is nothing next to the model.
    """
    global _ocr, _ocr_api
    if _ocr is not None:
        return _ocr

    from paddleocr import PaddleOCR

    try:
        _ocr = PaddleOCR(lang="japan", use_textline_orientation=True)
        _ocr_api = "3.x"
    except TypeError:
        _ocr = PaddleOCR(lang="japan", use_angle_cls=True, show_log=False)
        _ocr_api = "2.x"
    return _ocr


def check(key: str | None) -> None:
    if SHARED_SECRET and key != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Bad or missing X-Spendly-Key.")


def strip_thinking(text: str) -> str:
    """
    Remove a reasoning model's private working.

    Qwen3 thinks before it answers and prints that reasoning inline. Left in, it
    breaks the JSON parse and is not something the app should ever see.
    """
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    return re.sub(r"</?think>", "", text, flags=re.IGNORECASE).strip()


async def ask(prompt: str, timeout: float) -> str:
    """One call to the local model, with thinking off and room for a long receipt."""
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        # Qwen3 honours this; older builds ignore it, hence strip_thinking too.
        "think": False,
        # The default 4096 is not enough for a forty-line receipt plus its reply.
        "options": {"temperature": 0, "num_ctx": 8192},
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(f"{OLLAMA}/api/generate", json=payload)
            res.raise_for_status()
            return strip_thinking(res.json().get("response", ""))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Ollama unreachable: {exc}") from exc


class ReadRequest(BaseModel):
    image: str


class ExtractRequest(BaseModel):
    lines: list[str]


class TranslateRequest(BaseModel):
    names: list[str]


@app.get("/health")
def health() -> dict[str, Any]:
    """Cheap enough for the phone to call before deciding where to send a photo."""
    return {"ok": True, "model": MODEL, "ocr_loaded": _ocr is not None, "ocr_api": _ocr_api}


def fragments(result: Any) -> list[dict]:
    """
    Flatten a PaddleOCR result into {text, top, left, height}, either version.

    3.x returns a list of dicts carrying `rec_texts` and `rec_polys`; 2.x
    returns nested lists of [box, (text, confidence)]. Both describe the same
    thing, and the geometry is what matters here.
    """
    out: list[dict] = []

    def add(text: str, poly) -> None:
        if not text or not str(text).strip():
            return
        ys = [float(p[1]) for p in poly]
        xs = [float(p[0]) for p in poly]
        out.append(
            {
                "text": str(text).strip(),
                "top": min(ys),
                "left": min(xs),
                "height": max(ys) - min(ys),
            }
        )

    # 3.x
    if isinstance(result, list) and result and isinstance(result[0], dict):
        for page in result:
            texts = page.get("rec_texts") or []
            polys = page.get("rec_polys") or page.get("dt_polys") or []
            for text, poly in zip(texts, polys):
                add(text, poly)
        return out

    # 2.x
    for page in result or []:
        for entry in page or []:
            try:
                poly, (text, _conf) = entry[0], entry[1]
                add(text, poly)
            except Exception:  # noqa: BLE001, S112
                continue
    return out


def rows_from_fragments(items: list[dict]) -> list[str]:
    """
    Rebuild the receipt's rows from where the text physically sits.

    A receipt is two columns — names left, prices right — and OCR returns
    fragments in its own order. Reading them as they come gives every name and
    then every price, which is how a ¥1,160 line ends up as "*1," with its
    amount attached to nothing. Grouping by vertical overlap restores the rows
    the paper actually has.
    """
    if not items:
        return []

    heights = sorted(i["height"] for i in items)
    median = heights[len(heights) // 2] or 1.0
    tolerance = median * 0.6

    items = sorted(items, key=lambda i: i["top"])
    rows: list[list[dict]] = []
    for it in items:
        centre = it["top"] + it["height"] / 2
        if rows:
            row = rows[-1]
            row_centre = sum(r["top"] + r["height"] / 2 for r in row) / len(row)
            if abs(centre - row_centre) <= tolerance:
                row.append(it)
                continue
        rows.append([it])

    out = []
    for row in rows:
        row.sort(key=lambda i: i["left"])
        text = " ".join(r["text"] for r in row)
        # OCR splits "1,160" into "1," and "160"; a comma before exactly three
        # digits is a thousands separator, so close it up.
        text = re.sub(r"(\d),\s+(?=\d{3}(?!\d))", r"\1,", text)
        text = re.sub(r"([¥￥])\s+(?=\d)", r"\1", text)
        out.append(re.sub(r"\s+", " ", text).strip())
    return [r for r in out if r]


@app.post("/read")
def read(req: ReadRequest, x_spendly_key: str | None = Header(default=None)) -> dict[str, Any]:
    check(x_spendly_key)

    raw = req.image.split(",", 1)[-1] if req.image.startswith("data:") else req.image
    try:
        image = Image.open(io.BytesIO(base64.b64decode(raw))).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read that image: {exc}") from exc

    import numpy as np

    engine = ocr()
    array = np.array(image)
    result = engine.predict(array) if hasattr(engine, "predict") else engine.ocr(array, cls=True)

    lines = rows_from_fragments(fragments(result))
    return {"lines": lines, "engine": f"paddleocr {_ocr_api}"}


EXTRACT_PROMPT = """You turn the text of a Japanese supermarket receipt into structured items.

Reply with ONLY a JSON object, no prose:
{"merchant": str|null, "purchased_on": "YYYY-MM-DD"|null, "total": int|null,
 "items": [{"name": str, "amount": int}]}

Rules:
- amount and total are the printed numbers in yen, as integers.
- Copy each product name EXACTLY as printed. Do not translate it here.
- Strip the till's product code from the front: "510_", "#514_", "514.".
- EXCLUDE 小計, 合計, お買上計, tax lines, お預り, お釣り, ポイント, and card
  or payment lines.
- A unit-price line like "(¥116 X 2個)" belongs to the item above it. Skip it.
- INCLUDE 値引 and 割引 as items with a NEGATIVE amount.
- If a line is unreadable, leave it out rather than inventing a price."""


@app.post("/extract")
async def extract(
    req: ExtractRequest, x_spendly_key: str | None = Header(default=None)
) -> dict[str, Any]:
    """Structure a receipt the deterministic parser could not. Fallback only."""
    check(x_spendly_key)
    lines = [l for l in req.lines if l and l.strip()][:400]
    if not lines:
        return {"items": [], "merchant": None, "purchased_on": None, "total": None}

    text = await ask(
        EXTRACT_PROMPT + "\n\nReceipt text:\n" + "\n".join(lines) + "\n\nJSON:", timeout=300
    )

    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise HTTPException(status_code=422, detail="Model did not return JSON.")
    try:
        data = json.loads(text[start : end + 1])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Unparseable JSON: {exc}") from exc

    items = [
        {"name": str(i["name"]).strip(), "amount": int(i["amount"])}
        for i in data.get("items", [])
        if isinstance(i, dict) and i.get("name") and isinstance(i.get("amount"), (int, float))
    ]
    return {
        "merchant": data.get("merchant"),
        "purchased_on": data.get("purchased_on"),
        "total": data.get("total"),
        "items": items,
        "model": MODEL,
    }


TRANSLATE_PROMPT = """You translate Japanese supermarket product names into English.

Reply with ONLY a JSON array of strings, the same length and order as the input.
Keep each short — what the thing is, as a shopper would say it.
Keep brand names in romaji. No commentary, no code fences.
If a name is garbled by OCR, translate what it most likely says; if it is
unreadable, return it unchanged."""


@app.post("/translate")
async def translate(
    req: TranslateRequest, x_spendly_key: str | None = Header(default=None)
) -> dict[str, Any]:
    check(x_spendly_key)
    names = [n for n in req.names if n and n.strip()][:200]
    if not names:
        return {"translations": []}

    text = await ask(
        TRANSLATE_PROMPT
        + "\n\nInput:\n"
        + json.dumps(names, ensure_ascii=False)
        + "\n\nOutput:",
        timeout=240,
    )

    start, end = text.find("["), text.rfind("]")
    if start < 0 or end <= start:
        # Unusable reply: hand back the originals rather than a wrong mapping.
        return {"translations": names, "model": MODEL, "parsed": False}
    try:
        arr = json.loads(text[start : end + 1])
    except Exception:  # noqa: BLE001
        return {"translations": names, "model": MODEL, "parsed": False}

    out = [
        arr[i].strip()
        if i < len(arr) and isinstance(arr[i], str) and arr[i].strip()
        else names[i]
        for i in range(len(names))
    ]
    return {"translations": out, "model": MODEL, "parsed": True}
