import argparse
import sys
import time
 
import httpx
import psycopg2
from psycopg2.extras import execute_batch
from tqdm import tqdm
 
from db_config import get_db_url, get_tmdb_key
 
API = "https://api.themoviedb.org/3"
DELAY = 0.05
BATCH = 50
 
INSERT_SQL = """
    INSERT INTO movies (
        source_id, catalog_source, media_type, title, overview, release_date,
        release_year, genre, studio, runtime_min, director, cast_members,
        vote_average, vote_count, poster_url, backdrop_path
    )
    VALUES (%(source_id)s, 'tmdb', %(media_type)s, %(title)s, %(overview)s,
            %(release_date)s, %(release_year)s, %(genre)s, %(studio)s,
            %(runtime_min)s, %(director)s, %(cast_members)s, %(vote_average)s,
            %(vote_count)s, %(poster_url)s, %(backdrop_path)s)
    ON CONFLICT (source_id) DO NOTHING;
"""
 
 
def discover(client, key, year, page, lang=None, tv=False):
    params = {
        "api_key": key,
        "sort_by": "popularity.desc",
        "page": page,
    }
    if tv:
        params["first_air_date_year"] = year
    else:
        params["primary_release_year"] = year
        params["include_adult"] = "false"
    if lang:
        params["with_original_language"] = lang
    r = client.get(f"{API}/discover/{'tv' if tv else 'movie'}", params=params)
    if r.status_code != 200:
        return []
    return r.json().get("results", [])
 
 
def find_by_title(client, key, query, tv=False):
    """Fetch one named title rather than trawling by year."""
    r = client.get(
        f"{API}/search/{'tv' if tv else 'movie'}",
        params={"api_key": key, "query": query},
    )
    if r.status_code != 200:
        return []
    results = r.json().get("results", [])
    for m in results[:5]:
        name = m.get("name") or m.get("title")
        date = m.get("first_air_date") or m.get("release_date") or "?"
        print(f"  found: {name} ({date[:4]})  id={m['id']}")
    return [m["id"] for m in results[:5]]
 
 
def detail(client, key, tmdb_id, tv=False):
    r = client.get(
        f"{API}/{'tv' if tv else 'movie'}/{tmdb_id}",
        params={"api_key": key, "append_to_response": "credits"},
    )
    if r.status_code != 200:
        return None
    d = r.json()
    credits = d.get("credits") or {}
 
    if tv:
        # A series has creators rather than a director, and airs on a network
        # rather than being made by a production company.
        director = ", ".join(c["name"] for c in (d.get("created_by") or []))
        studio = ", ".join(n["name"] for n in (d.get("networks") or [])[:2])[:250]
        runtime = (d.get("episode_run_time") or [None])[0]
        rel = (d.get("first_air_date") or "").strip() or None
        seasons = d.get("number_of_seasons")
        episodes = d.get("number_of_episodes")
    else:
        director = ", ".join(
            c["name"] for c in (credits.get("crew") or []) if c.get("job") == "Director"
        )
        # studio is VARCHAR(255); director and cast are TEXT, so this is the
        # only field here that can overflow its column.
        studio = ", ".join(
            c["name"] for c in (d.get("production_companies") or [])[:2]
        )[:250]
        runtime = d.get("runtime")
        rel = (d.get("release_date") or "").strip() or None
        seasons = episodes = None
 
    cast = ", ".join(c["name"] for c in (credits.get("cast") or [])[:8])
    genre = ", ".join(g["name"] for g in (d.get("genres") or []))
 
    overview = (d.get("overview") or "").strip() or None
    if tv and seasons:
        # Put the shape of the series into the text that gets embedded, so
        # "ww2 documentary series" can match on "series" at all.
        overview = (
            f"TV series, {seasons} season{'s' if seasons != 1 else ''}"
            + (f", {episodes} episodes" if episodes else "")
            + (f". {overview}" if overview else "")
        )
 
    return {
        "source_id": (f"tv{d['id']}" if tv else str(d["id"])),
        "media_type": "tv" if tv else "movie",
        "title": d.get("name") if tv else (d.get("title") or d.get("original_title")),
        "overview": overview,
        "release_date": rel,
        "release_year": int(rel[:4]) if rel and rel[:4].isdigit() else None,
        "genre": genre or None,
        "studio": studio or None,
        "runtime_min": runtime,
        "director": director or None,
        "cast_members": cast or None,
        "vote_average": d.get("vote_average"),
        "vote_count": d.get("vote_count"),
        "poster_url": d.get("poster_path"),
        "backdrop_path": d.get("backdrop_path"),
    }
 
 
def build_context(row):
    """Must match reembed.py exactly: field VALUES only, no label words, or
    these rows land in a slightly different place in the vector space than
    everything else."""
    parts = [
        row.get("title"), None,
        str(row["release_year"]) if row.get("release_year") else None,
        row.get("genre"), row.get("director"), row.get("cast_members"),
        row.get("studio"), row.get("overview"),
    ]
    seen, out = set(), []
    for p in parts:
        p = (str(p).strip() if p is not None else "")
        if p and p.lower() not in ("none", "nan") and p not in seen:
            seen.add(p)
            out.append(p)
    return ". ".join(out)
 
 
def embed_missing(conn):
    from encoder import OnnxEncoder
 
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM movies WHERE embedding IS NULL;")
        n = cur.fetchone()[0]
    if not n:
        print("Every row already has an embedding.")
        return
 
    print(f"\nEmbedding {n} new rows with the int8 ONNX model...")
    model = OnnxEncoder("models/onnx/model_quantized.onnx", "models/tokenizer.json")
 
    from psycopg2.extras import RealDictCursor
 
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, title, title_ka, overview, genre, director,
                   cast_members, studio, release_year
            FROM movies WHERE embedding IS NULL ORDER BY id;
            """
        )
        rows = cur.fetchall()
 
    updates = []
    for i in tqdm(range(0, len(rows), 64), desc="embedding"):
        chunk = rows[i:i + 64]
        embs = model.encode(
            [build_context(r) for r in chunk], normalize_embeddings=True
        )
        for row, emb in zip(chunk, embs):
            vec = "[" + ",".join(str(x) for x in emb.tolist()) + "]"
            updates.append((vec, row["id"]))
 
    with conn.cursor() as cur:
        execute_batch(
            cur, "UPDATE movies SET embedding = %s::vector WHERE id = %s;",
            updates, page_size=200,
        )
    conn.commit()
    print(f"Embedded {len(updates)} rows.")
 
 
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--years", default="2018-2026", help="e.g. 2018-2026")
    ap.add_argument("--pages", type=int, default=10, help="20 films per page, per year")
    ap.add_argument("--lang", default=None, help="original language, e.g. ka")
    ap.add_argument("--tv", action="store_true", help="series instead of films")
    ap.add_argument("--find", default=None, help='fetch one title by name')
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skip-embed", action="store_true")
    ap.add_argument("--embed-only", action="store_true",
                    help="skip fetching; just embed rows whose embedding is NULL")
    args = ap.parse_args()
 
    key = get_tmdb_key()
    if not key:
        print("TMDB_API_KEY is not set in .env")
        return 1
 
    try:
        y1, y2 = (int(x) for x in args.years.split("-"))
    except ValueError:
        print("--years must look like 2018-2026")
        return 1
 
    conn = psycopg2.connect(get_db_url())
    try:
        if args.embed_only:
            embed_missing(conn)
            return 0
 
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM movies;")
            before = cur.fetchone()[0]
        print(f"Catalogue before: {before} rows")
 
        kind = "series" if args.tv else "films"
        seen_ids, inserted = set(), 0
        with httpx.Client(timeout=12.0) as client:
            if args.find:
                print(f'Searching TMDb {"tv" if args.tv else "movie"} for "{args.find}":')
                ids = find_by_title(client, key, args.find, args.tv)
            else:
                # Collect the ids first so the progress bar is honest about size
                ids = []
                for year in range(y1, y2 + 1):
                    for page in range(1, args.pages + 1):
                        for m in discover(client, key, year, page, args.lang, args.tv):
                            if m["id"] not in seen_ids:
                                seen_ids.add(m["id"])
                                ids.append(m["id"])
                        time.sleep(DELAY)
            print(f"Found {len(ids)} candidate {kind} from TMDb.")
 
            if args.dry_run:
                print("--dry-run: stopping before any write.")
                return 0
 
            batch = []
            for tmdb_id in tqdm(ids, desc="details"):
                row = detail(client, key, tmdb_id, args.tv)
                if row and row["title"]:
                    batch.append(row)
                if len(batch) >= BATCH:
                    with conn.cursor() as cur:
                        execute_batch(cur, INSERT_SQL, batch, page_size=BATCH)
                    conn.commit()
                    inserted += len(batch)
                    batch = []
                time.sleep(DELAY)
 
            if batch:
                with conn.cursor() as cur:
                    execute_batch(cur, INSERT_SQL, batch, page_size=BATCH)
                conn.commit()
                inserted += len(batch)
 
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM movies;")
            after = cur.fetchone()[0]
        print(f"\nProcessed {inserted} {kind}, {after - before} were new.")
 
        if not args.skip_embed:
            embed_missing(conn)
 
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT coalesce(media_type, 'movie') AS kind,
                       min(release_year), max(release_year), count(*)
                FROM movies WHERE catalog_source = 'tmdb'
                GROUP BY 1 ORDER BY 1;
                """
            )
            for k, lo, hi, n in cur.fetchall():
                print(f"\nTMDb {k}: {n} rows, years {lo}-{hi}")
    finally:
        conn.close()
    return 0
 
 
if __name__ == "__main__":
    sys.exit(main())