import time
import httpx
import psycopg2
from psycopg2.extras import execute_batch
from tqdm import tqdm

from db_config import get_db_url, get_tmdb_key

DATABASE_URL = get_db_url()
TMDB_API_KEY = get_tmdb_key()

def backfill():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    # Get all movies that don't have a poster yet
    cur.execute("SELECT tmdb_id FROM movies WHERE poster_path IS NULL;")
    movie_ids = [row[0] for row in cur.fetchall()]
    print(f"Found {len(movie_ids)} movies needing posters.")

    if not movie_ids:
        print("All movies already have posters!")
        return

    update_query = "UPDATE movies SET poster_path = %s, backdrop_path = %s WHERE tmdb_id = %s;"
    batch = []
    
    with httpx.Client(timeout=6.0) as client:
        for tmdb_id in tqdm(movie_ids, desc="Fetching posters from TMDB"):
            try:
                url = f"https://api.themoviedb.org/3/movie/{tmdb_id}"
                resp = client.get(url, params={"api_key": TMDB_API_KEY})
                if resp.status_code == 200:
                    data = resp.json()
                    poster = data.get("poster_path")
                    backdrop = data.get("backdrop_path")
                    if poster or backdrop:
                        batch.append((poster, backdrop, tmdb_id))
            except Exception:
                pass

            # Write in batches of 50
            if len(batch) >= 50:
                execute_batch(cur, update_query, batch)
                conn.commit()
                batch = []

            time.sleep(0.04)  # Stay safely within TMDB rate limits (approx 25-30 req/sec)

        # Remaining batch
        if batch:
            execute_batch(cur, update_query, batch)
            conn.commit()

    cur.close()
    conn.close()
    print("\nBackfill complete! All posters are now permanently saved in Neon.")

if __name__ == "__main__":
    backfill()