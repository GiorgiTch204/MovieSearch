import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Extract standard psycopg2 sync URI from async URI
SYNC_DB_URL = "postgresql://neondb_owner:npg_IjCEriXM8W0S@ep-lingering-water-b1xllb5n-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require"

sql = """
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watchlists (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, movie_id)
);
"""

conn = psycopg2.connect(SYNC_DB_URL)
cur = conn.cursor()
cur.execute(sql)
conn.commit()
cur.close()
conn.close()
print("Auth & Watchlist tables verified and ready in Neon!")