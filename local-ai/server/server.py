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
# qwen3:4b is NOT usable here, despite being the obvious choice. It is a
# reasoning model and reasons unconditionally: `think: false`, `/no_think` and
# the chat endpoint's own flag are all ignored by Ollama 0.33.2, which only
# changes where the reasoning is reported, not whether it happens. Measured on
# this machine, translating eight short product names produced 8,776 characters
# of deliberation across 2,500 tokens in 133 seconds and still never reached an
# answer. Raw speed is fine at ~21 tokens/second; it simply never stops.
#
# Use an instruct model that does not reason. qwen2.5:3b is the natural fit for
# Japanese; llama3.2:3b and gemma2:2b also work.
MODEL = os.environ.get("SPENDLY_MODEL", "qwen2.5:3b")

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
        # enable_mkldnn=False is not optional on this stack. PaddlePaddle 3.3.1's
        # PIR executor cannot convert a oneDNN attribute the text-detection model
        # uses, and inference dies with:
        #   NotImplementedError: ConvertPirAttribute2RuntimeAttribute not support
        #   [pir::ArrayAttribute<pir::DoubleAttribute>]
        # Turning oneDNN off takes the plain CPU path, which works. The
        # FLAGS_use_mkldnn environment variable does not help — PaddleOCR sets
        # its own value over it.
        _ocr = PaddleOCR(lang="japan", use_textline_orientation=True, enable_mkldnn=False)
        _ocr_api = "3.x"
    except TypeError:
        _ocr = PaddleOCR(lang="japan", use_angle_cls=True, show_log=False, enable_mkldnn=False)
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


# Long enough for a real answer, short enough that a reasoning model's endless
# deliberation is reported as a problem instead of hanging the phone.
MAX_TOKENS = int(os.environ.get("SPENDLY_MAX_TOKENS", "1200"))


async def ask(prompt: str, timeout: float) -> str:
    """One call to the local model, capped so it cannot deliberate for ever."""
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        # Qwen3 honours this; older builds ignore it, hence strip_thinking too.
        "think": False,
        # The default 4096 is not enough for a forty-line receipt plus its reply.
        "options": {"temperature": 0, "num_ctx": 8192, "num_predict": MAX_TOKENS},
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(f"{OLLAMA}/api/generate", json=payload)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail=f"Ollama is not answering at {OLLAMA}. Is it running? ({exc})",
        ) from exc

    # A 404 here means the model is missing, not that Ollama is down — a
    # distinction worth making, because the fix is one command.
    if res.status_code == 404:
        raise HTTPException(
            status_code=503,
            detail=f"The model '{MODEL}' is not installed. Run:  ollama pull {MODEL}",
        )
    if res.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Ollama returned {res.status_code}.")

    body = res.json()

    answer = strip_thinking(body.get("response", ""))
    if answer:
        return answer

    # An empty answer after a full budget means the model spent it thinking.
    # Say so plainly: no amount of retrying fixes a reasoning model here.
    thinking = body.get("thinking") or ""
    if thinking or body.get("done_reason") == "length":
        raise HTTPException(
            status_code=503,
            detail=(
                f"{MODEL} used its whole budget reasoning and never answered. "
                "Reasoning models cannot be used here — try an instruct model "
                "such as qwen2.5:3b, and set SPENDLY_MODEL to it."
            ),
        )
    return ""


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


PRICE_ONLY = re.compile(r"^[*¥￥\s]*[\d,.]+\s*[)）]?$")
NOT_A_PRODUCT = re.compile(r"担当者|領収|领収|毎日|簡単|ぜひ|レジ|TEL|電話")


def rows_from_fragments(items: list[dict]) -> list[str]:
    """
    Rebuild the receipt's rows from where the text physically sits.

    A receipt is two columns, names left and prices right, and OCR returns
    fragments in its own order. Three things make naive grouping fail, and all
    three showed up on a real photo:

    1. Photos are skewed. The price column drifted from 10px above its name at
       the top of the page to 16px below it at the bottom, so "nearest centre"
       hands a price to the wrong row.
    2. Assignments must not cross. Matching greedily let row N take price N+1
       while row N+1 took price N.
    3. Unit-price lines — "(¥116 × 2個)" — carry no price of their own. Left
       eligible they absorb the price belonging to the item below and shift
       every pairing down the page by one. This was the largest single cause.

    So: group the left column into rows, then align rows to prices with a
    dynamic program that can skip either side but never reorder. Order is the
    one thing a skewed photo cannot disturb.
    """
    if not items:
        return []

    heights = sorted(i["height"] for i in items)
    median = heights[len(heights) // 2] or 1.0

    def centre(f: dict) -> float:
        return f["top"] + f["height"] / 2

    right_edge = max(f["left"] for f in items)
    prices = sorted(
        (f for f in items if PRICE_ONLY.match(f["text"].strip()) and f["left"] >= right_edge * 0.6),
        key=lambda f: f["top"],
    )
    price_ids = {id(p) for p in prices}
    names = [f for f in items if id(f) not in price_ids]

    # Group the left-hand column into rows. 0.35 of a line height was measured
    # on a real receipt as the point where rows stop merging into each other.
    rows: list[list[dict]] = []
    for f in sorted(names, key=lambda f: f["top"]):
        if rows and abs(centre(f) - centre(rows[-1][0])) <= median * 0.35:
            rows[-1].append(f)
            continue
        rows.append([f])

    def row_centre(row: list[dict]) -> float:
        return sum(centre(f) for f in row) / len(row)

    def can_hold_a_price(row: list[dict]) -> bool:
        text = " ".join(f["text"] for f in row)
        if "×" in text or " x " in text.lower():
            return False
        return not NOT_A_PRODUCT.search(text)

    eligible = [i for i, r in enumerate(rows) if can_hold_a_price(r)]
    candidates = [rows[i] for i in eligible]

    pairs: dict[int, int] = {}
    if candidates and prices:
        R, P = len(candidates), len(prices)
        inf = float("inf")
        skip = median * 0.9
        cost = [[inf] * (P + 1) for _ in range(R + 1)]
        back: list[list[Any]] = [[None] * (P + 1) for _ in range(R + 1)]
        cost[0][0] = 0.0

        for i in range(R + 1):
            for j in range(P + 1):
                here = cost[i][j]
                if here == inf:
                    continue
                if i < R and here + skip < cost[i + 1][j]:
                    cost[i + 1][j] = here + skip
                    back[i + 1][j] = (i, j, None)
                if j < P and here + skip < cost[i][j + 1]:
                    cost[i][j + 1] = here + skip
                    back[i][j + 1] = (i, j, None)
                if i < R and j < P:
                    d = abs(row_centre(candidates[i]) - centre(prices[j]))
                    if d <= median * 1.5 and here + d < cost[i + 1][j + 1]:
                        cost[i + 1][j + 1] = here + d
                        back[i + 1][j + 1] = (i, j, (i, j))

        matched: dict[int, int] = {}
        i, j = R, P
        while (i, j) != (0, 0) and back[i][j] is not None:
            pi, pj, m = back[i][j]
            if m:
                matched[m[0]] = m[1]
            i, j = pi, pj
        pairs = {eligible[k]: v for k, v in matched.items()}

    taken = set(pairs.values())
    built: list[tuple[float, str]] = []
    for ri, row in enumerate(rows):
        cells = list(row) + ([prices[pairs[ri]]] if ri in pairs else [])
        cells.sort(key=lambda f: f["left"])
        built.append((min(f["top"] for f in cells), " ".join(f["text"] for f in cells)))
    for pj, p in enumerate(prices):
        if pj not in taken:
            built.append((p["top"], p["text"]))

    out = []
    for _top, text in sorted(built, key=lambda t: t[0]):
        # OCR splits "1,160" into "1," and "160"; a comma before exactly three
        # digits is a thousands separator, so close it up.
        text = re.sub(r"(\d),\s+(?=\d{3}(?!\d))", r",", text)
        text = re.sub(r"([¥￥])\s+(?=\d)", r"", text)
        text = re.sub(r"\s+", " ", text).strip()
        if text:
            out.append(text)
    return out


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

- Say what the thing IS, briefly, as a shopper would: 牛乳ケーキ -> "Milk Cake".
- Never substitute a different brand or product. カステラ is a sponge cake
  called castella, not any other confectionery. If you do not recognise a word,
  transliterate it rather than guessing at something familiar.
- Keep Japanese brand names in romaji: 日清 -> "Nissin", QBB -> "QBB".
- These names come from OCR and may be misspelt. Translate the most likely
  intended product; if it is unreadable, return the input unchanged.
- No commentary, no code fences, no explanation."""


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
