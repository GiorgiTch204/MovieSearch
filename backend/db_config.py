import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")


def get_db_url() -> str:
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        print("ERROR: DATABASE_URL is not set. Create a .env file in the project root.")
        sys.exit(1)

    db_url = raw_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if "?" not in db_url:
        db_url += "?sslmode=require"
    elif "sslmode=" not in db_url:
        db_url += "&sslmode=require"
    return db_url


def get_tmdb_key() -> str:
    key = os.getenv("TMDB_API_KEY")
    if not key:
        print("ERROR: TMDB_API_KEY is not set in .env")
        sys.exit(1)
    return key