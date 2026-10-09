import time

import httpx
import psycopg2
from psycopg2.extras import execute_batch
from tqdm import tqdm

from db_config import get_db_url, get_tmdb_key

BATCH = 50
DELAY = 0.04  # ~25 req/s, inside TMDb's limit


def backfill():
    api_key = get_tmdb_key()
    if not api_key:
        print("TMDB_API_KEY is not set in .env")
        return

    conn = psycopg2.connect(get_db_url())
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT count(*) FILTER (WHERE poster_url IS NULL),
                       count(*)
                FROM movies
                WHERE catalog_source = 'tmdb';
                """
            )
            missing, total = cur.fetchone()
            print(f"TMDb rows: {total},  missing a poster: {missing}")

            cur.execute(
                """
                SELECT id, source_id
                FROM movies
                WHERE catalog_source = 'tmdb'
                  AND source_id IS NOT NULL
                  AND poster_url IS NULL
                ORDER BY id;
                """
            )
            rows = cur.fetchall()

        if not rows:
            print("Nothing to do.")
            return

        print(f"Fetching {len(rows)} from TMDb (~{len(rows) * DELAY / 60:.0f} min)...")

        update_sql = """
            UPDATE movies
            SET poster_url    = COALESCE(%s, poster_url),
                backdrop_path = COALESCE(%s, backdrop_path)
            WHERE id = %s;
        """

        batch, written, not_found = [], 0, 0
        with httpx.Client(timeout=8.0) as client:
            for movie_id, source_id in tqdm(rows, desc="posters"):
                try:
                    resp = client.get(
                        f"https://api.themoviedb.org/3/movie/{source_id}",
                        params={"api_key": api_key},
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        poster = data.get("poster_path")
                        backdrop = data.get("backdrop_path")
                        if poster or backdrop:
                            batch.append((poster, backdrop, movie_id))
                    elif resp.status_code == 404:
                        not_found += 1
                except Exception:
                    pass

                if len(batch) >= BATCH:
                    with conn.cursor() as cur:
                        execute_batch(cur, update_sql, batch)
                    conn.commit()
                    written += len(batch)
                    batch = []

                time.sleep(DELAY)

        if batch:
            with conn.cursor() as cur:
                execute_batch(cur, update_sql, batch)
            conn.commit()
            written += len(batch)

        with conn.cursor() as cur:
            cur.execute(
                "SELECT count(*) FROM movies "
                "WHERE catalog_source = 'tmdb' AND poster_url IS NULL;"
            )
            still_missing = cur.fetchone()[0]

        print(f"\nrows updated:           {written}")
        print(f"not found on TMDb:      {not_found}")
        print(f"TMDb rows still absent: {still_missing}")
    finally:
        conn.close()


if __name__ == "__main__":
    backfill()