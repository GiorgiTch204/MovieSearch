"""Prints the real connection error instead of hiding it behind a 500."""
import psycopg2

from db_config import get_db_url

url = get_db_url()

# Mask the password so this is safe to paste into chat
masked = url
if "@" in url and "//" in url:
    head, tail = url.split("@", 1)
    proto, creds = head.split("//", 1)
    user = creds.split(":")[0]
    masked = f"{proto}//{user}:***@{tail}"

print(f"URL in use: {masked}\n")

try:
    conn = psycopg2.connect(url)
    with conn.cursor() as cur:
        cur.execute("SELECT current_database(), current_user, version();")
        db, user, ver = cur.fetchone()
    conn.close()
    print(f"CONNECTED  db={db}  user={user}")
    print(ver.split(",")[0])
except Exception as e:
    print(f"FAILED  {type(e).__name__}")
    print(e)