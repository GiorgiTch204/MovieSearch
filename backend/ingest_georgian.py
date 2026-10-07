import os
import sys
import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
from tqdm import tqdm

# Load .env from project root
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(ROOT_DIR, ".env"))

DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    print("Error: DATABASE_URL not found in .env")
    sys.exit(1)

# ასწორებს asyncpg პრეფიქსს psycopg2-ის ფორმატზე და ამატებს SSL რეჟიმს Neon-ისთვის
if DB_URL.startswith("postgresql+asyncpg://"):
    DB_URL = DB_URL.replace("postgresql+asyncpg://", "postgresql://", 1)

if "?" not in DB_URL:
    DB_URL += "?sslmode=require"
elif "sslmode=" not in DB_URL:
    DB_URL += "&sslmode=require"

CSV_PATH = os.path.join(ROOT_DIR, "data", "georgian_movies_final.csv")
if not os.path.exists(CSV_PATH):
    print(f"Error: {CSV_PATH} not found.")
    sys.exit(1)

print("Loading multilingual embedding model (paraphrase-multilingual-MiniLM-L12-v2)...")
model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

def setup_table(conn):
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
        
        # 1. ძველი NOT NULL შეზღუდვების მოხსნა
        for col in ["tmdb_id", "title", "overview", "original_title"]:
            cur.execute(f"""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'movies' AND column_name = '{col}'
                    ) THEN
                        ALTER TABLE movies ALTER COLUMN {col} DROP NOT NULL;
                    END IF;
                END $$;
            """)

        # 2. საჭირო სვეტების დამატება
        columns_to_add = [
            ("source_id", "VARCHAR(64)"),
            ("catalog_source", "VARCHAR(32) DEFAULT 'geocinema'"),
            ("movie_id", "INT"),
            ("title_ka", "VARCHAR(255)"),
            ("release_year", "INT"),
            ("genre", "VARCHAR(100)"),
            ("studio", "VARCHAR(255)"),
            ("runtime_min", "INT"),
            ("director", "TEXT"),
            ("writer", "TEXT"),
            ("cinematographer", "TEXT"),
            ("production_designer", "TEXT"),
            ("composer", "TEXT"),
            ("cast_members", "TEXT"),
            ("detail_url", "TEXT"),
            ("poster_url", "TEXT"),
            ("fts_doc", "TSVECTOR"),
            ("embedding", "VECTOR(384)")
        ]
        
        for col_name, col_type in columns_to_add:
            cur.execute(f"ALTER TABLE movies ADD COLUMN IF NOT EXISTS {col_name} {col_type};")

        # 3. უნიკალურობის შეზღუდვა source_id-ზე
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'movies_source_id_key'
                ) THEN
                    ALTER TABLE movies ADD CONSTRAINT movies_source_id_key UNIQUE (source_id);
                END IF;
            END $$;
        """)

        # 4. ინდექსები
        cur.execute("CREATE INDEX IF NOT EXISTS idx_movies_fts ON movies USING gin(fts_doc);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_movies_embedding ON movies USING hnsw (embedding vector_cosine_ops);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_movies_catalog_year ON movies (catalog_source, release_year);")
        conn.commit()
    print("Database table, schema modifications, and indexes ready.")

def clean_val(val):
    if pd.isna(val) or val is None or str(val).strip().lower() in ["nan", "none", ""]:
        return None
    return str(val).strip()

def clean_int(val):
    if pd.isna(val) or val is None:
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None

def main():
    df = pd.read_csv(CSV_PATH)
    print(f"Found {len(df)} movies in {CSV_PATH}")

    conn = psycopg2.connect(DB_URL)
    setup_table(conn)

    records = []
    texts_to_embed = []

    for idx, row in df.iterrows():
        movie_id = clean_int(row.get("movie_id"))
        title_ka = clean_val(row.get("title_ka")) or "უსათაურო"
        year = clean_int(row.get("release_year"))
        genre = clean_val(row.get("genre"))
        studio = clean_val(row.get("studio"))
        runtime = clean_int(row.get("runtime_min"))
        director = clean_val(row.get("director"))
        writer = clean_val(row.get("writer"))
        cinematographer = clean_val(row.get("cinematographer"))
        production_designer = clean_val(row.get("production_designer"))
        composer = clean_val(row.get("composer"))
        cast = clean_val(row.get("cast"))
        detail_url = clean_val(row.get("detail_url"))
        poster_url = clean_val(row.get("poster_url"))

        source_id = f"geocinema_{movie_id}" if movie_id else f"geocinema_idx_{idx}"

        # Semantic context for vector search
        text_context = (
            f"ფილმი: {title_ka}. "
            f"გამოშვების წელი: {year or 'უცნობი'}. "
            f"ჟანრი: {genre or 'ზოგადი'}. "
            f"სტუდია: {studio or ''}. "
            f"რეჟისორი: {director or ''}. "
            f"სცენარისტი: {writer or ''}. "
            f"მსახიობები: {cast or ''}."
        )

        texts_to_embed.append(text_context)
        records.append({
            "source_id": source_id,
            "catalog_source": "geocinema",
            "movie_id": movie_id,
            "title_ka": title_ka,
            "release_year": year,
            "genre": genre,
            "studio": studio,
            "runtime_min": runtime,
            "director": director,
            "writer": writer,
            "cinematographer": cinematographer,
            "production_designer": production_designer,
            "composer": composer,
            "cast_members": cast,
            "detail_url": detail_url,
            "poster_url": poster_url,
            "fts_a": f"{title_ka} {director or ''}",
            "fts_b": f"{cast or ''} {genre or ''} {studio or ''} {writer or ''}"
        })

    print("Generating multilingual embeddings...")
    batch_size = 64
    all_embeddings = []
    for i in tqdm(range(0, len(texts_to_embed), batch_size)):
        chunk = texts_to_embed[i:i + batch_size]
        emb = model.encode(chunk, normalize_embeddings=True, show_progress_bar=False)
        all_embeddings.extend(emb.tolist())

    insert_rows = []
    for rec, emb in zip(records, all_embeddings):
        emb_str = f"[{','.join(str(x) for x in emb)}]"
        insert_rows.append((
            rec["source_id"],
            rec["catalog_source"],
            rec["movie_id"],
            rec["title_ka"],       # title (ძველი სვეტისთვის)
            rec["title_ka"],       # title_ka (ახალი სვეტისთვის)
            rec["release_year"],
            rec["genre"],
            rec["studio"],
            rec["runtime_min"],
            rec["director"],
            rec["writer"],
            rec["cinematographer"],
            rec["production_designer"],
            rec["composer"],
            rec["cast_members"],
            rec["detail_url"],
            rec["poster_url"],
            rec["fts_a"],
            rec["fts_b"],
            emb_str
        ))

    insert_query = """
        INSERT INTO movies (
            source_id, catalog_source, movie_id, title, title_ka, release_year,
            genre, studio, runtime_min, director, writer, cinematographer,
            production_designer, composer, cast_members, detail_url,
            poster_url, fts_doc, embedding
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s,
            setweight(to_tsvector('simple', COALESCE(%s, '')), 'A') ||
            setweight(to_tsvector('simple', COALESCE(%s, '')), 'B'),
            %s::vector
        )
        ON CONFLICT (source_id) DO UPDATE SET
            title = EXCLUDED.title,
            title_ka = EXCLUDED.title_ka,
            release_year = EXCLUDED.release_year,
            genre = EXCLUDED.genre,
            director = EXCLUDED.director,
            cast_members = EXCLUDED.cast_members,
            poster_url = EXCLUDED.poster_url,
            fts_doc = EXCLUDED.fts_doc,
            embedding = EXCLUDED.embedding;
    """

    print("Inserting into database...")
    with conn.cursor() as cur:
        execute_batch(cur, insert_query, insert_rows, page_size=200)
        conn.commit()

    conn.close()
    print("Ingestion complete.")

if __name__ == "__main__":
    main()