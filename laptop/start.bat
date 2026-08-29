@echo off
REM Start the Spendly laptop service.
REM
REM SPENDLY_KEY is a password you invent. The phone sends it with every request;
REM a tunnel is a public address, so without this anyone who finds the URL can
REM use your laptop. Put the same value in the app's Settings.

set SPENDLY_KEY=change-me-to-something-long
set SPENDLY_MODEL=qwen3:4b
set OLLAMA_URL=http://127.0.0.1:11434

cd /d "%~dp0"
python -m uvicorn server:app --host 0.0.0.0 --port 8756
