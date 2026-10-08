import psycopg2

from db_config import get_db_url


def column_exists(cur, table: str, column: str) -> bool:
    cur.execute(
        """
        SELECT 1 FROM information_schema.columns
        WHERE table_name = %s AND column_name = %s;
        """,
        (table, column),
    )
    return cur.fetchone() is not None


def main():
    conn = psycopg2.connect(get_db_url())
    try:
        with conn.cursor() as cur:
            # 1. release_year from release_date
            cur.execute("""
                UPDATE movies
                SET release_year = EXTRACT(YEAR FROM release_date)::INT
                WHERE release_year IS NULL
                  AND release_date IS NOT NULL;
            """)
            print(f"release_year backfilled on {cur.rowcount} rows.")

            # 2. source_id from the legacy tmdb_id column, if present.
            #    Stored BARE (no prefix) because main.py uses source_id
            #    directly as the TMDb id when calling their API.
            if column_exists(cur, "movies", "tmdb_id"):
                cur.execute("""
                    UPDATE movies
                    SET source_id = tmdb_id::text
                    WHERE source_id IS NULL
                      AND tmdb_id IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1 FROM movies m2
                          WHERE m2.source_id = movies.tmdb_id::text
                      );
                """)
                print(f"source_id backfilled on {cur.rowcount} rows.")
            else:
                print("No legacy tmdb_id column; skipping source_id backfill.")

            conn.commit()

            # 3. Report
            cur.execute("""
                SELECT catalog_source,
                       count(*)                                   AS rows,
                       count(*) FILTER (WHERE release_year IS NULL) AS no_year,
                       count(*) FILTER (WHERE source_id IS NULL)    AS no_source_id,
                       min(release_year)                          AS earliest,
                       max(release_year)                          AS latest
                FROM movies
                GROUP BY catalog_source;
            """)
            print()
            for r in cur.fetchall():
                print(
                    f"  {r[0]:<10} rows={r[1]:<5} no_year={r[2]:<5} "
                    f"no_source_id={r[3]:<5} years={r[4]}-{r[5]}"
                )
    finally:
        conn.close()


if __name__ == "__main__":
    main()