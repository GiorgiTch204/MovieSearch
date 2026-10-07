import psycopg2
from psycopg2.extras import RealDictCursor

from db_config import get_db_url

QUERIES = [
    ("Rows per catalog_source", """
        SELECT COALESCE(catalog_source, '<NULL>') AS catalog,
               count(*) AS rows,
               count(embedding) AS with_embedding,
               count(fts_doc)   AS with_fts
        FROM movies
        GROUP BY catalog_source
        ORDER BY rows DESC;
    """),
    ("Missing critical fields", """
        SELECT
            count(*) FILTER (WHERE embedding IS NULL)      AS no_embedding,
            count(*) FILTER (WHERE catalog_source IS NULL) AS no_catalog,
            count(*) FILTER (WHERE source_id IS NULL)      AS no_source_id,
            count(*) FILTER (WHERE title IS NULL
                             AND title_ka IS NULL)         AS no_title
        FROM movies;
    """),
    ("Sample titles", """
        SELECT COALESCE(catalog_source, '<NULL>') AS catalog,
               COALESCE(title_ka, title) AS name,
               release_year
        FROM movies
        ORDER BY random()
        LIMIT 8;
    """),
]


def main():
    conn = psycopg2.connect(get_db_url())
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for label, sql in QUERIES:
                print(f"\n=== {label} ===")
                cur.execute(sql)
                for row in cur.fetchall():
                    print("  " + "  ".join(f"{k}={v}" for k, v in row.items()))
    finally:
        conn.close()
    print()


if __name__ == "__main__":
    main()