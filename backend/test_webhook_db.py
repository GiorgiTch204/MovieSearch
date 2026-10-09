import psycopg2

from db_config import get_db_url

USER_ID = 11  # cr7@gmail.com

conn = psycopg2.connect(get_db_url())
try:
    with conn.cursor() as cur:
        print("1. checking payments table shape...")
        cur.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'payments'
            ORDER BY ordinal_position;
        """)
        for c in cur.fetchall():
            print(f"   {c[0]:<20} {c[1]}")

        print("\n2. checking constraints on payments...")
        cur.execute("""
            SELECT conname, pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'payments'::regclass;
        """)
        rows = cur.fetchall()
        if not rows:
            print("   (none)")
        for c in rows:
            print(f"   {c[0]}: {c[1]}")

    print("\n3. running the webhook's UPDATE + INSERT...")
    with conn.cursor() as cur:
        cur.execute("UPDATE users SET is_pro = TRUE WHERE id = %s;", (USER_ID,))
        cur.execute(
            """
            INSERT INTO payments
                (user_id, stripe_session_id, amount, currency, status)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (stripe_session_id) DO NOTHING;
            """,
            (USER_ID, "cs_test_manual_diagnostic", 999, "usd", "paid"),
        )
    conn.commit()
    print(f"   OK - user {USER_ID} is now Pro")

except Exception as e:
    conn.rollback()
    print(f"\n   *** FAILED: {type(e).__name__} ***")
    print(f"   {e}")
finally:
    conn.close()