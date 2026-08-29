# Spendly laptop service

Reads receipts and translates them on your own machine, with no daily limit.

The phone still does the parsing and classification — those are tested against
real receipts and there should only be one copy of those rules. This service
replaces only the two steps that cost OpenRouter requests:

| Endpoint | Job | Replaces |
|---|---|---|
| `POST /read` | photo → lines of text | the vision model |
| `POST /translate` | Japanese names → English | the translation model |

## Setup, once

```bat
pip install -r requirements.txt
ollama pull qwen3:4b
```

`qwen3:4b` at Q4 is about 2.5GB and fits an RTX 3050's 4GB comfortably. An 8B
would need roughly 5GB and would spill into system RAM, which is slow — 4B is
the right size for this card, not a compromise.

## Running it

Edit `start.bat` and set `SPENDLY_KEY` to a long random string, then:

```bat
start.bat
```

Check it is alive: <http://localhost:8756/health>

## Reaching it from the phone

On the same wifi, the phone can use `http://<laptop-ip>:8756` directly.

From anywhere, a free Cloudflare tunnel:

```bat
cloudflared tunnel --url http://localhost:8756
```

That prints a public https URL. Put that URL and your `SPENDLY_KEY` into the
app under Settings → Laptop service.

## Security

`SPENDLY_KEY` is the only thing between the tunnel and the open internet. Make
it long, and treat it like a password. The service never stores images.
