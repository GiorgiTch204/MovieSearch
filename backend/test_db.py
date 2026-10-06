import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_IjCEriXM8W0S@ep-lingering-water-b1xllb5n-pooler.c-5.eu-central-1.aws.neon.tech/neondb?sslmode=require"

schema_sql = """
-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Drop table if it exists partially
DROP TABLE IF EXISTS watchlists CASCADE;
DROP TABLE IF EXISTS movies CASCADE;

-- 3. Movies table (fts_doc as standard tsvector)
CREATE TABLE movies (
    id BIGSERIAL PRIMARY KEY,
    tmdb_id INTEGER UNIQUE NOT NULL,
    title VARCHAR(512) NOT NULL,
    tagline TEXT,
    overview TEXT NOT NULL,
    release_date DATE,
    poster_path VARCHAR(255),
    backdrop_path VARCHAR(255),
    genres TEXT[] DEFAULT '{}',
    director VARCHAR(255),
    cast_names TEXT[] DEFAULT '{}',
    vote_average NUMERIC(3, 1) DEFAULT 0.0,
    vote_count INTEGER DEFAULT 0,
    embedding vector(384),
    fts_doc tsvector
);

-- 4. Trigger function to compute full-text tokens automatically on INSERT or UPDATE
CREATE OR REPLACE FUNCTION update_movies_fts() RETURNS trigger AS $$
BEGIN
    NEW.fts_doc := 
        setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.director, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(array_to_string(NEW.cast_names, ' '), '')), 'B') ||
        setweight(to_tsvector('english', coalesce(NEW.overview, '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movies_fts_update
BEFORE INSERT OR UPDATE ON movies
FOR EACH ROW EXECUTE FUNCTION update_movies_fts();

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_movies_embedding 
    ON movies USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_movies_fts 
    ON movies USING gin (fts_doc);

CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id 
    ON movies (tmdb_id);
"""

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("Connected! Creating extensions, table, trigger, and indexes...")
    cur.execute(schema_sql)
    conn.commit()
    print("Table 'movies' and trigger created successfully!")

    # Verify
    cur.execute("SELECT count(*) FROM movies;")
    count = cur.fetchone()[0]
    print(f"Verification successful: 'movies' table is ready with {count} rows.")

    cur.close()
    conn.close()
except Exception as e:
    print("Error:", e)