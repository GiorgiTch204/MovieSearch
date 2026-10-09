import psycopg2
from psycopg2.extras import RealDictCursor

from db_config import get_db_url

RULES = {
    "a": "NO ACTION  <-- blocks the delete",
    "r": "RESTRICT   <-- blocks the delete",
    "c": "CASCADE",
    "n": "SET NULL",
    "d": "SET DEFAULT",
}


def main():
    conn = psycopg2.connect(get_db_url())
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT c.conname,
                       c.conrelid::regclass::text AS child_table,
                       a.attname                  AS child_column,
                       c.confdeltype              AS on_delete
                FROM pg_constraint c
                JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
                JOIN pg_attribute a
                  ON a.attrelid = c.conrelid AND a.attnum = k.attnum
                WHERE c.contype = 'f'
                  AND c.confrelid = 'users'::regclass
                ORDER BY child_table;
                """
            )
            rows = cur.fetchall()

        if not rows:
            print("No foreign keys reference users at all.")
            return

        print(f"\n{'table.column':<28} {'constraint':<34} ON DELETE")
        print("-" * 86)
        for r in rows:
            target = f"{r['child_table']}.{r['child_column']}"
            rule = RULES.get(r["on_delete"], r["on_delete"])
            print(f"{target:<28} {r['conname']:<34} {rule}")

        bad = [r for r in rows if r["on_delete"] in ("a", "r")]
        print()
        if bad:
            print("These block user deletion. Fix by re-running backend/schema.py")
            print("after adding the DO block that rewrites the payments constraint.")
        else:
            print("All good -- nothing here blocks deleting a user.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()