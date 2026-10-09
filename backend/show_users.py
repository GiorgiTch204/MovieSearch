"""List every registered user with their plan and admin flag.

    python backend/show_users.py
"""
import psycopg2
from psycopg2.extras import RealDictCursor

from db_config import get_db_url


def main():
    conn = psycopg2.connect(get_db_url())
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
                "is_admin BOOLEAN DEFAULT FALSE;"
            )
            conn.commit()

            cur.execute(
                """
                SELECT id, username, email,
                       coalesce(is_pro,   FALSE) AS is_pro,
                       coalesce(is_admin, FALSE) AS is_admin
                FROM users
                ORDER BY id;
                """
            )
            rows = cur.fetchall()

        print(f"{'id':<5} {'username':<20} {'email':<35} flags")
        print("-" * 75)
        for r in rows:
            flags = []
            if r["is_admin"]:
                flags.append("ADMIN")
            if r["is_pro"]:
                flags.append("PRO")
            print(
                f"#{r['id']:<4} {(r['username'] or '-'):<20} "
                f"{r['email']:<35} {' '.join(flags) or 'free'}"
            )
        print(f"\n{len(rows)} user(s).")
    finally:
        conn.close()


if __name__ == "__main__":
    main()