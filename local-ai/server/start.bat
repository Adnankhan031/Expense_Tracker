@echo off
REM Start the Spendly local service.
REM
REM SPENDLY_KEY is a password you invent. The phone sends it with every request.
REM A tunnel is a public address, so without this anyone who finds the URL can
REM use your laptop. Put the same value into the app under Settings.

set SPENDLY_KEY=change-me-to-something-long
set SPENDLY_MODEL=qwen3:4b
set OLLAMA_URL=http://127.0.0.1:11434

cd /d "%~dp0"
call .venv\Scripts\activate
python -m uvicorn server:app --host 0.0.0.0 --port 8756
