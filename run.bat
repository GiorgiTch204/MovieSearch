@echo off
title Movie Semantic Search Demo

cd /d "%~dp0"

echo   Starting Movie Semantic Search Demo...

if not exist "venv\Scripts\python.exe" (
    echo.
    echo ERROR: Virtual environment not found.
    echo Please create it first:
    echo python -m venv venv
    echo venv\Scripts\activate
    echo python -m pip install fastapi uvicorn pandas chromadb sentence-transformers
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
echo Starting FastAPI server...
start "MovieSearch Server" cmd /k "venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000"

echo.
echo Waiting for server to start...
timeout /t 10 /nobreak > nul

echo.
echo Opening Swagger documentation...
start "" "http://127.0.0.1:8000/docs"

echo.
echo Opening frontend page...
start "" "%~dp0frontend\index.html"

echo.
echo   Demo started successfully!
echo.
echo Server:  http://127.0.0.1:8000
echo Swagger: http://127.0.0.1:8000/docs
echo Frontend: frontend\index.html
echo.
pause