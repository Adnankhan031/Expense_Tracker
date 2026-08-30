# Spendly local service

Reads and translates receipts on this machine, with no daily limit.

| Endpoint | Job | Replaces |
|---|---|---|
| `POST /read` | photo → lines of text | the cloud vision model |
| `POST /extract` | lines → items | *fallback only*, see below |
| `POST /translate` | Japanese names → English | the cloud translation model |

Parsing and classification stay on the phone. They are tested against a real
業務スーパー receipt and get 20 of 20 items reconciling to the yen, so there is
one copy of the receipt rules rather than two that drift. `/extract` is for the
layouts those rules have never seen — a model that returns nineteen items one
run and twenty-one the next cannot be held to a test, and the parser can.

## Check it works before involving the phone

```bat
.venv\Scripts\activate
python smoke_test.py "..\..\uploads\WhatsApp Image 2026-08-30 at 06.58.33.jpeg"
```

That prints the OCR rows and then a few translations, with timings. If the rows
look like the receipt, everything downstream already has tests.

## Running it

Edit `start.bat`, set `SPENDLY_KEY` to a long random string, then:

```bat
start.bat
```

Alive check: <http://localhost:8756/health>

## Reaching it from the phone

Same wifi: `http://<laptop-ip>:8756`.

From anywhere, a free Cloudflare tunnel:

```bat
cloudflared tunnel --url http://localhost:8756
```

Put the printed https URL and your `SPENDLY_KEY` into the app under
**Settings → Laptop service**, then press **Test**.

## The model matters more than the size

**Do not use `qwen3:4b`.** It is a reasoning model, and it reasons whether or
not you ask it to — `think: false`, `/no_think`, and the chat endpoint's own
flag are all ignored by Ollama 0.33.2, which only changes *where* the reasoning
is reported. Measured here: translating eight short product names produced
8,776 characters of deliberation over 2,500 tokens in 133 seconds and still
never reached an answer. Speed is not the problem — it runs at about 21
tokens/second — it simply never stops.

Use an instruct model:

```bat
ollama pull qwen2.5:3b
```

`qwen2.5:3b` is strong on Japanese and fits the 4GB card comfortably.
`llama3.2:3b` and `gemma2:2b` also work. The service refuses fast and says so
if it is pointed at a model that only reasons.

## Notes on this hardware

**PaddleOCR needs `enable_mkldnn=False`.** PaddlePaddle 3.3.1's PIR executor
cannot convert a oneDNN attribute the text-detection model uses, and inference
dies with `ConvertPirAttribute2RuntimeAttribute not support`. Turning oneDNN
off takes the plain CPU path, which works. The `FLAGS_use_mkldnn` environment
variable does not help — PaddleOCR overrides it.

**PaddleOCR stays on CPU.** The RTX 3050 has 4GB and Qwen3 4B is already using
most of it — the `33%/67% CPU/GPU` split Ollama reports means it does not
quite fit either. OCR on CPU takes a second or two, which is nothing beside
the model, and competing for the same VRAM would slow both.

**Thinking is turned off.** Qwen3 reasons before answering and prints that
working inline, which would break the JSON parse. The service asks for it off
and strips `<think>` blocks anyway, in case a build ignores the flag.

**Context is raised to 8192.** The default 4096 is not enough for a forty-line
receipt plus its reply.
