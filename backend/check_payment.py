import os
import sys
from datetime import datetime

import psycopg2
import stripe
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

from db_config import get_db_url

load_dotenv()


def stripe_dict(obj):
    """stripe-python >= 8 returns StripeObject, which is NOT a dict and has
    no .get(). Convert the whole tree once, then treat it as ordinary data."""
    if isinstance(obj, dict):
        return obj
    to_dict = getattr(obj, "to_dict", None)
    return to_dict() if callable(to_dict) else dict(obj)


def list_sessions() -> int:
    """No session id given -- show the recent ones so you can pick."""
    try:
        sessions = stripe.checkout.Session.list(limit=10)
    except Exception as e:
        print(f"Could not list sessions: {e}")
        return 1

    rows = [stripe_dict(x) for x in (sessions.data or [])]
    if not rows:
        print("No checkout sessions found on this Stripe account/mode yet.")
        return 0

    print(f"\n{'created':<18} {'status':<10} {'amount':<10} {'user':<6} session id")
    print("-" * 92)
    for s in rows:
        created = datetime.fromtimestamp(s.get("created", 0)).strftime("%Y-%m-%d %H:%M")
        amount = f"{(s.get('amount_total') or 0) / 100:.2f} {(s.get('currency') or '').upper()}"
        uid = (s.get("metadata") or {}).get("user_id") or s.get("client_reference_id") or "-"
        print(f"{created:<18} {str(s.get('payment_status')):<10} {amount:<10} {str(uid):<6} {s.get('id')}")

    print("\nRe-run with one of those ids, e.g.:")
    print(f"    python backend/check_payment.py {rows[0].get('id')}")
    return 0


def main() -> int:
    key = os.getenv("STRIPE_SECRET_KEY")
    print(f"1. STRIPE_SECRET_KEY   : {('set, starts ' + key[:8]) if key else '*** MISSING ***'}")
    if not key or not key.startswith("sk_"):
        print("   -> .env is wrong. This must start with sk_, not whsec_.")
        return 1
    stripe.api_key = key

    if len(sys.argv) < 2:
        return list_sessions()
    session_id = sys.argv[1].strip()

    if session_id.endswith("...") or session_id == "cs_test_a1b2c3...":
        print("\nThat is the placeholder from the instructions, not a real id.")
        print("Run the script with no arguments to list your actual sessions.")
        return 1

    fe = os.getenv("FRONTEND_URL")
    print(f"2. FRONTEND_URL        : {fe or '*** not set -> defaults to http://localhost:3000 ***'}")
    if fe and "localhost" in fe:
        print("   -> note: on Render this must be your Vercel URL, or Stripe")
        print("      redirects buyers to localhost after paying.")

    try:
        s = stripe_dict(stripe.checkout.Session.retrieve(session_id))
    except Exception as e:
        print(f"3. retrieve session    : FAILED -> {e}")
        print("   -> wrong session id, or the key belongs to a different Stripe account/mode.")
        return 1

    print("3. retrieve session    : ok")
    print(f"   payment_status      : {s.get('payment_status')}")
    print(f"   amount_total        : {s.get('amount_total')} {s.get('currency')}")
    print(f"   livemode            : {s.get('livemode')}")
    print(f"   metadata            : {dict(s.get('metadata') or {})}")
    print(f"   client_reference_id : {s.get('client_reference_id')}")

    uid = (s.get("metadata") or {}).get("user_id") or s.get("client_reference_id")
    if not uid:
        print("   -> NO user_id on the session. Neither the webhook nor the confirm")
        print("      endpoint can tell who paid. The checkout was created without it.")
        return 1

    conn = psycopg2.connect(get_db_url())
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, username, email, coalesce(is_pro, FALSE) AS is_pro "
                "FROM users WHERE id = %s;",
                (int(uid),),
            )
            u = cur.fetchone()
            if not u:
                print(f"4. user {uid} in DB      : *** NOT FOUND ***")
                return 1
            print(f"4. user {uid} in DB      : {u['username'] or u['email']}   is_pro={u['is_pro']}")

            cur.execute(
                "SELECT id, status, amount, created_at FROM payments "
                "WHERE stripe_session_id = %s;",
                (session_id,),
            )
            p = cur.fetchone()
            if p:
                print(f"5. payments row        : yes, status={p['status']}, {p['created_at']}")
            else:
                print("5. payments row        : NONE")
                print("   -> neither the webhook nor /api/checkout/confirm ever ran")
                print("      successfully for this session.")

            print()
            if s.get("payment_status") != "paid":
                print(f"VERDICT: Stripe says this session is '{s.get('payment_status')}', not paid.")
                print("         Nothing to apply.")
                return 0

            if u["is_pro"]:
                print("VERDICT: Stripe says paid and the user already has Pro. Nothing to fix.")
                return 0

            print("VERDICT: Stripe says PAID but the account is still on the free plan.")
            print("         So the upgrade step never ran. Fix the trigger, but you can")
            print("         apply this one now.")
            ans = input("\n         Apply the upgrade for this session? [y/N] ").strip().lower()
            if ans == "y":
                cur.execute(
                    "UPDATE users SET is_pro = TRUE WHERE id = %s;", (int(uid),)
                )
                cur.execute(
                    """
                    INSERT INTO payments
                        (user_id, stripe_session_id, amount, currency, status)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (stripe_session_id) DO NOTHING;
                    """,
                    (
                        int(uid),
                        s.get("id"),
                        s.get("amount_total"),
                        s.get("currency"),
                        s.get("payment_status"),
                    ),
                )
                conn.commit()
                print("         Applied. Log out and back in to see it.")
            else:
                print("         Left unchanged.")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())