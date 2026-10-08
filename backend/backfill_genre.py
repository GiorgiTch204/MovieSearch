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
            if column_exists(cur, "movies", "genres"):
                cur.execute("""
                    UPDATE movies
                    SET genre = array_to_string(genres, ', ')
                    WHERE genre IS NULL
                      AND genres IS NOT NULL
                      AND array_length(genres, 1) > 0;
                """)
                print(f"genre recovered on {cur.rowcount} rows.")
            else:
                print("No legacy genres column found.")

            if column_exists(cur, "movies", "cast_names"):
                cur.execute("""
                    UPDATE movies
                    SET cast_members = array_to_string(cast_names, ', ')
                    WHERE cast_members IS NULL
                      AND cast_names IS NOT NULL
                      AND array_length(cast_names, 1) > 0;
                """)
                print(f"cast_members recovered on {cur.rowcount} rows.")
            else:
                print("No legacy cast_names column found.")

            conn.commit()

            cur.execute("""
                SELECT catalog_source,
                       count(*)                                     AS rows,
                       count(*) FILTER (WHERE genre IS NULL)        AS no_genre,
                       count(*) FILTER (WHERE director IS NULL)     AS no_director,
                       count(*) FILTER (WHERE cast_members IS NULL) AS no_cast
                FROM movies
                GROUP BY catalog_source;
            """)
            print()
            for r in cur.fetchall():
                print(
                    f"  {r[0]:<10} rows={r[1]:<5} no_genre={r[2]:<5} "
                    f"no_director={r[3]:<5} no_cast={r[4]:<5}"
                )

            cur.execute("""
                SELECT genre, count(*) FROM movies
                WHERE catalog_source = 'tmdb' AND genre IS NOT NULL
                GROUP BY genre ORDER BY count(*) DESC LIMIT 5;
            """)
            rows = cur.fetchall()
            if rows:
                print("\n  Most common TMDb genre strings:")
                for g, c in rows:
                    print(f"    {c:<5} {g}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()