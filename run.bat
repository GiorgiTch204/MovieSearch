@echo off
echo ===================================================
echo   Starting FastAPI Semantic Search Server...
echo ===================================================

".\venv\Scripts\uvicorn.exe" main:app --reload --reload-exclude "venv"

pause