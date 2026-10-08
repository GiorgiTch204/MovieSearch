import psycopg2
from psycopg2.extras import RealDictCursor

from db_config import get_db_url

FIELD_COVERAGE = """
SELECT catalog_source,
       count(*)                                                   AS rows,
       round(100.0 * count(overview)      / count(*), 1)          AS pct_overview,
       round(100.0 * count(genre)         / count(*), 1)          AS pct_genre,
       round(100.0 * count(director)      / count(*), 1)          AS pct_director,
       round(100.0 * count(cast_members)  / count(*), 1)          AS pct_cast,
       round(100.0 * count(studio)        / count(*), 1)          AS pct_studio
FROM movies
GROUP BY catalog_source;
"""

TEXT_VOLUME = """
SELECT catalog_source,
       round(avg(length(concat_ws('. ',
           title, title_ka, genre, director, cast_members, studio, overview
       ))))                                                       AS avg_chars,
       min(length(concat_ws('. ',
           title, title_ka, genre, director, cast_members, studio, overview
       )))                                                        AS min_chars,
       max(length(concat_ws('. ',
           title, title_ka, genre, director, cast_members, studio, overview
       )))                                                        AS max_chars
FROM movies
GROUP BY catalog_source;
"""

GEO_GENRES = """
SELECT COALESCE(genre, '<NULL>') AS genre, count(*) AS n
FROM movies WHERE catalog_source = 'geocinema'
GROUP BY genre ORDER BY n DESC LIMIT 12;
"""

THIN_ROWS = """
SELECT catalog_source, count(*) AS n
FROM movies
WHERE length(concat_ws('. ',
          title, title_ka, genre, director, cast_members, studio, overview
      )) < 60
GROUP BY catalog_source;
"""


def run(cur, label, sql):
    print(f"\n=== {label} ===")
    cur.execute(sql)
    for row in cur.fetchall():
        print("  " + "  ".join(f"{k}={v}" for k, v in row.items()))


def main():
    conn = psycopg2.connect(get_db_url())
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            run(cur, "Field coverage (% non-null)", FIELD_COVERAGE)
            run(cur, "Embedded text volume (characters)", TEXT_VOLUME)
            run(cur, "Rows with under 60 chars of text", THIN_ROWS)
            run(cur, "Georgian genre distribution", GEO_GENRES)
    finally:
        conn.close()
    print()


if __name__ == "__main__":
    main()