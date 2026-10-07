import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

raw_url = os.getenv("DATABASE_URL")
if not raw_url:
    raise ValueError("DATABASE_URL is missing from .env")

# Format database URL for psycopg2
db_url = raw_url.replace("postgresql+asyncpg://", "postgresql://", 1)
if "?" not in db_url:
    db_url += "?sslmode=require"
elif "sslmode=" not in db_url:
    db_url += "&sslmode=require"

print("Connecting to database...")
conn = psycopg2.connect(db_url)
cur = conn.cursor()

print("Creating payment tables if they don't exist...")
cur.execute("""
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    is_pro BOOLEAN DEFAULT FALSE,
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    stripe_session_id VARCHAR(255) UNIQUE,
    amount INT,
    currency VARCHAR(10),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

conn.commit()
cur.close()
conn.close()

print("Payment tables created successfully!")