"""
Spendly's laptop service: read receipts and translate them, with no quota.

Two jobs, both of which the free cloud tier rations:

  POST /read       a receipt photo -> the lines of text on it (PaddleOCR)
  POST /translate  Japanese product names -> English (Ollama, local model)

The phone keeps the parsing and classification it already has, tested against
real receipts. This service only replaces the two steps that cost requests, so
there is one implementation of the receipt rules rather than two that drift.

Run:
    python -m uvicorn server:app --host 0.0.0.0 --port 8756
"""

from __future__ import annotations

import base64
import io
import os
import re
from typing import Any

import httpx
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

# A tunnel is a public address, so a shared secret is the difference between
# "my phone can reach my laptop" and "anyone can".
SHARED_SECRET = os.environ.get("SPENDLY_KEY", "")
OLLAMA = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("SPENDLY_MODEL", "qwen3:4b")

app = FastAPI(title="Spendly laptop service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

_ocr = None


def ocr():
    """Load PaddleOCR once, on first use — it takes a few seconds."""
    global _ocr
    if _ocr is None:
        from paddleocr import PaddleOCR

        # japan covers kanji, kana and the half-width katakana receipts print.
        _ocr = PaddleOCR(use_angle_cls=True, lang="japan", show_log=False)
    return _ocr


def check(key: str | None) -> None:
    if SHARED_SECRET and key != SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Bad or missing X-Spendly-Key.")


class ReadRequest(BaseModel):
    image: str  # data URL or bare base64


class TranslateRequest(BaseModel):
    names: list[str]


@app.get("/health")
def health() -> dict[str, Any]:
    """Cheap enough for the phone to call before deciding where to send a photo."""
    return {"ok": True, "model": MODEL, "ocr_loaded": _ocr is not None}


def rows_from_boxes(result: list) -> list[str]:
    """
    Rebuild the receipt's rows from where the text physically sits.

    PaddleOCR returns each fragment with its four corners, and a receipt is two
    columns: names on the left, prices on the right. Reading fragments in the
    order they arrive gives every name and then every price, so they are grouped
    by vertical overlap and ordered left to right — the layout the paper has.
    """
    items = []
    for line in result or []:
        for entry in line or []:
            box, (text, conf) = entry[0], entry[1]
            if not text or not text.strip():
                continue
            ys = [p[1] for p in box]
            xs = [p[0] for p in box]
            items.append(
                {
                    "text": text.strip(),
                    "top": min(ys),
                    "left": min(xs),
                    "height": max(ys) - min(ys),
                    "conf": conf,
                }
            )

    if not items:
        return []

    heights = sorted(i["height"] for i in items)
    median = heights[len(heights) // 2] or 1
    tolerance = median * 0.6

    items.sort(key=lambda i: i["top"])
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
        # OCR splits "1,160" into "1," and "160"; a comma followed by exactly
        # three digits is a thousands separator, so close it up.
        text = re.sub(r"(\d),\s+(?=\d{3}(?!\d))", r"\1,", text)
        text = re.sub(r"([¥￥])\s+(?=\d)", r"\1", text)
        out.append(re.sub(r"\s+", " ", text).strip())
    return [r for r in out if r]


@app.post("/read")
def read(req: ReadRequest, x_spendly_key: str | None = Header(default=None)) -> dict[str, Any]:
    check(x_spendly_key)

    raw = req.image.split(",", 1)[-1] if req.image.startswith("data:") else req.image
    try:
        data = base64.b64decode(raw)
        image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not read that image: {exc}") from exc

    import numpy as np

    result = ocr().ocr(np.array(image), cls=True)
    lines = rows_from_boxes(result)
    return {"lines": lines, "engine": "paddleocr"}


TRANSLATE_PROMPT = """You translate Japanese supermarket product names into English.

Reply with ONLY a JSON array of strings, same length and order as the input.
Keep each one short — what the thing is, as a shopper would say it.
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

    import json

    payload = {
        "model": MODEL,
        "prompt": f"{TRANSLATE_PROMPT}\n\nInput:\n{json.dumps(names, ensure_ascii=False)}\n\nOutput:",
        "stream": False,
        "options": {"temperature": 0},
    }

    try:
        async with httpx.AsyncClient(timeout=180) as client:
            res = await client.post(f"{OLLAMA}/api/generate", json=payload)
            res.raise_for_status()
            text = res.json().get("response", "")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Ollama unreachable: {exc}") from exc

    start, end = text.find("["), text.rfind("]")
    if start < 0 or end <= start:
        # Unusable reply: hand back the originals rather than a wrong mapping.
        return {"translations": names, "model": MODEL, "parsed": False}

    try:
        arr = json.loads(text[start : end + 1])
    except Exception:  # noqa: BLE001
        return {"translations": names, "model": MODEL, "parsed": False}

    out = [
        arr[i].strip() if i < len(arr) and isinstance(arr[i], str) and arr[i].strip() else names[i]
        for i in range(len(names))
    ]
    return {"translations": out, "model": MODEL, "parsed": True}
