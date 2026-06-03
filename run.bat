@echo off
title Movie Semantic Search Server

cd /d "%~dp0"

echo   Starting FastAPI Semantic Search Server...

if not exist "venv\Scripts\python.exe" (
    echo.
    echo ERROR: Virtual environment not found.
    echo Please create it first:
    echo python -m venv venv
    echo venv\Scripts\activate
    echo python -m pip install -r backend\requirements.txt
    echo.
    pause
    exit /b
)

if not exist "data\tmdb_5000_movies.csv" (
    echo.
    echo ERROR: Dataset file not found.
    echo Required path:
    echo data\tmdb_5000_movies.csv
    echo.
    pause
    exit /b
)

echo.
echo Server will run at:
echo http://127.0.0.1:8000
echo.
echo Swagger documentation:
echo http://127.0.0.1:8000/docs
echo.

"venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000

pause