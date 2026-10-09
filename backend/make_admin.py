import sys

import psycopg2
from psycopg2.extras import RealDictCursor

from db_config import get_db_url


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    revoke = "--revoke" in sys.argv
    listing = "--list" in sys.argv

    if not listing and not args:
        print(__doc__)
        return 1

    conn = psycopg2.connect(get_db_url())
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
                "is_admin BOOLEAN DEFAULT FALSE;"
            )
            conn.commit()

            if listing:
                cur.execute(
                    "SELECT id, username, email FROM users "
                    "WHERE is_admin ORDER BY id;"
                )
                rows = cur.fetchall()
                if not rows:
                    print("No admins yet.")
                for r in rows:
                    name = r["username"] or "-"
                    print(f"  #{r['id']:<4} {name:<20} {r['email']}")
                return 0

            target = args[0].strip().lower()
            cur.execute(
                """
                UPDATE users SET is_admin = %s
                WHERE LOWER(email) = %s OR LOWER(username) = %s
                RETURNING id, username, email, is_admin;
                """,
                (not revoke, target, target),
            )
            row = cur.fetchone()
            if not row:
                conn.rollback()
                print(f"No user matches '{args[0]}'.")
                return 1
            conn.commit()

            state = "IS NOW AN ADMIN" if row["is_admin"] else "is no longer an admin"
            print(f"#{row['id']}  {row['username'] or row['email']}  {state}")
            return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())