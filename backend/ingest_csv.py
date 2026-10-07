import json
import os
from pathlib import Path
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

from db_config import get_db_url

DATABASE_URL = get_db_url()
# Resolve path to CSV file
BASE_DIR = Path(__file__).resolve().parent.parent
CSV_PATH = BASE_DIR / "data" / "tmdb_5000_movies.csv"

def parse_json_names(json_str):
    """Extract name fields from JSON-like array columns (e.g. genres, keywords)."""
    if not isinstance(json_str, str) or not json_str.strip():
        return []
    try:
        items = json.loads(json_str)
        return [item["name"] for item in items if "name" in item]
    except Exception:
        return []

def build_context(title, genres, tagline, overview):
    """Assemble a descriptive document string for semantic embedding."""
    parts = [
        f"Title: {title}",
        f"Genres: {', '.join(genres)}" if genres else "",
        f"Tagline: {tagline}" if tagline else "",
        f"Plot: {overview}"
    ]
    return ". ".join([p for p in parts if p])

def main():
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at {CSV_PATH}")

    print(f"Loading dataset from: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH)

    # Clean missing critical fields
    df = df.dropna(subset=["overview"])
    df["title"] = df["title"].fillna("Untitled")
    df["tagline"] = df["tagline"].fillna("")
    df["release_date"] = pd.to_datetime(df["release_date"], errors="coerce")
    df["vote_average"] = df["vote_average"].fillna(0.0)
    df["vote_count"] = df["vote_count"].fillna(0).astype(int)

    print(f"Found {len(df)} valid movie records.")

    # Parse genres JSON
    df["genres_list"] = df["genres"].apply(parse_json_names)

    # Load SentenceTransformer model
    print("Loading embedding model (all-MiniLM-L6-v2)...")
    model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    data = df.to_dict(orient="records")
    # Construct context texts
    print("Building composite semantic text strings...")
    context_texts = [
        build_context(row["title"], row["genres_list"], row["tagline"], row["overview"])
        for _, row in df.iterrows()
    ]

    # Generate embeddings
    print("Generating dense vector embeddings (this takes ~1-2 minutes on CPU)...")
    embeddings = model.encode(
        context_texts,
        batch_size=64,
        show_progress_bar=True,
        normalize_embeddings=True
    )

    # Format data for PostgreSQL insertion
    records_to_insert = []
    for (_, row), emb in zip(df.iterrows(), embeddings):
        rel_date = row["release_date"].strftime("%Y-%m-%d") if pd.notnull(row["release_date"]) else None
        records_to_insert.append((
            int(row["id"]),
            str(row["title"]),
            str(row["tagline"]) if row["tagline"] else None,
            str(row["overview"]),
            rel_date,
            None,  # poster_path (optional for CSV dataset)
            None,  # backdrop_path
            row["genres_list"],
            None,  # director (optional from credits dataset)
            [],    # cast_names
            float(row["vote_average"]),
            int(row["vote_count"]),
            emb.tolist()
        ))

    # Insert into Neon DB
    print(f"Connecting to Neon to insert {len(records_to_insert)} records...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    insert_query = """
    INSERT INTO movies (
        tmdb_id, title, tagline, overview, release_date, poster_path,
        backdrop_path, genres, director, cast_names, vote_average,
        vote_count, embedding
    ) VALUES %s
    ON CONFLICT (tmdb_id) DO UPDATE SET
        title = EXCLUDED.title,
        tagline = EXCLUDED.tagline,
        overview = EXCLUDED.overview,
        genres = EXCLUDED.genres,
        vote_average = EXCLUDED.vote_average,
        vote_count = EXCLUDED.vote_count,
        embedding = EXCLUDED.embedding;
    """

    # Batch insert with chunks of 500
    batch_size = 500
    for i in tqdm(range(0, len(records_to_insert), batch_size), desc="Writing batches"):
        chunk = records_to_insert[i:i + batch_size]
        execute_values(cur, insert_query, chunk)
        conn.commit()

    # Verify count
    cur.execute("SELECT count(*) FROM movies;")
    final_count = cur.fetchone()[0]
    print(f"\nIngestion complete! Total movies stored in Neon DB: {final_count}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()