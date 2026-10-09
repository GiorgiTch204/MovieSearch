import time

import httpx
import psycopg2
from psycopg2.extras import execute_batch
from tqdm import tqdm

from db_config import get_db_url, get_tmdb_key

DELAY = 0.05
BATCH = 50

UPDATE_SQL = """
    UPDATE movies
    SET director     = COALESCE(%s, director),
        cast_members = COALESCE(%s, cast_members),
        studio       = COALESCE(%s, studio),
        runtime_min  = COALESCE(%s, runtime_min),
        embedding    = NULL
    WHERE id = %s;
"""


def main():
    key = get_tmdb_key()
    if not key:
        print("TMDB_API_KEY is not set in .env")
        return 1

    conn = psycopg2.connect(get_db_url())
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, source_id FROM movies
                WHERE catalog_source = 'tmdb'
                  AND source_id IS NOT NULL
                  AND source_id !~ '^tv'
                  AND (director IS NULL OR cast_members IS NULL)
                ORDER BY id;
                """
            )
            rows = cur.fetchall()

        if not rows:
            print("Every TMDb row already has credits.")
            return 0

        print(f"{len(rows)} rows need credits (~{len(rows) * DELAY / 60:.0f} min).")

        batch, written, missing = [], 0, 0
        with httpx.Client(timeout=10.0) as client:
            for movie_id, source_id in tqdm(rows, desc="credits"):
                try:
                    r = client.get(
                        f"https://api.themoviedb.org/3/movie/{source_id}",
                        params={"api_key": key, "append_to_response": "credits"},
                    )
                    if r.status_code != 200:
                        missing += 1
                        time.sleep(DELAY)
                        continue
                    d = r.json()
                    credits = d.get("credits") or {}

                    director = ", ".join(
                        c["name"]
                        for c in (credits.get("crew") or [])
                        if c.get("job") == "Director"
                    )
                    cast = ", ".join(
                        c["name"] for c in (credits.get("cast") or [])[:8]
                    )
                    studio = ", ".join(
                        c["name"] for c in (d.get("production_companies") or [])[:2]
                    )
                    batch.append(
                        (
                            director or None,
                            cast or None,
                            studio or None,
                            d.get("runtime"),
                            movie_id,
                        )
                    )
                except Exception:
                    missing += 1

                if len(batch) >= BATCH:
                    with conn.cursor() as cur:
                        execute_batch(cur, UPDATE_SQL, batch, page_size=BATCH)
                    conn.commit()
                    written += len(batch)
                    batch = []
                time.sleep(DELAY)

        if batch:
            with conn.cursor() as cur:
                execute_batch(cur, UPDATE_SQL, batch, page_size=BATCH)
            conn.commit()
            written += len(batch)

        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT count(*) FILTER (WHERE director IS NOT NULL),
                       count(*) FILTER (WHERE cast_members IS NOT NULL),
                       count(*)
                FROM movies WHERE catalog_source = 'tmdb';
                """
            )
            d_ok, c_ok, total = cur.fetchone()
            cur.execute("SELECT count(*) FROM movies WHERE embedding IS NULL;")
            stale = cur.fetchone()[0]

        print(f"\nrows updated:        {written}")
        print(f"not found on TMDb:   {missing}")
        print(f"TMDb with director:  {d_ok}/{total}")
        print(f"TMDb with cast:      {c_ok}/{total}")
        print(f"\n{stale} rows now need re-embedding. Run:")
        print("    python backend/ingest_tmdb.py --embed-only")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())