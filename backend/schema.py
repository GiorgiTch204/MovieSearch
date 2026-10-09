import psycopg2

from db_config import get_db_url

SCHEMA_SQL = """
-- ============================================================
-- 1. Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 2. movies
-- ============================================================
CREATE TABLE IF NOT EXISTS movies (
    id BIGSERIAL PRIMARY KEY
);

ALTER TABLE movies ADD COLUMN IF NOT EXISTS source_id            VARCHAR(64);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS catalog_source       VARCHAR(32);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS title                VARCHAR(512);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS title_ka             VARCHAR(255);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS tagline              TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS overview             TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS release_date         DATE;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS release_year         INT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS genre                VARCHAR(255);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS studio               VARCHAR(255);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS runtime_min          INT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS director             TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS writer               TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS cinematographer      TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS production_designer  TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS composer             TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS cast_members         TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS vote_average         NUMERIC(3, 1);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS vote_count           INTEGER DEFAULT 0;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS poster_url           TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS backdrop_path        VARCHAR(255);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS detail_url           TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS fts_doc              TSVECTOR;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS embedding            VECTOR(384);

-- Legacy NOT NULL constraints block the Georgian catalog (no overview/tmdb_id)
DO $$
DECLARE c TEXT;
BEGIN
    FOREACH c IN ARRAY ARRAY['tmdb_id', 'title', 'overview', 'original_title'] LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'movies' AND column_name = c) THEN
            EXECUTE format('ALTER TABLE movies ALTER COLUMN %I DROP NOT NULL', c);
        END IF;
    END LOOP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movies_source_id_key') THEN
        ALTER TABLE movies ADD CONSTRAINT movies_source_id_key UNIQUE (source_id);
    END IF;
END $$;

-- ============================================================
-- 3. Full-text search: ONE config ('simple') for both catalogs
-- ============================================================
DROP TRIGGER IF EXISTS trg_movies_fts_update ON movies;
DROP FUNCTION IF EXISTS update_movies_fts();

CREATE FUNCTION update_movies_fts() RETURNS trigger AS $$
BEGIN
    NEW.fts_doc :=
        setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.title_ka, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.director, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.cast_members, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.genre, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.studio, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(NEW.overview, '')), 'C');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movies_fts_update
BEFORE INSERT OR UPDATE ON movies
FOR EACH ROW EXECUTE FUNCTION update_movies_fts();

-- ============================================================
-- 4. users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar            BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_mime       VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMPTZ;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username           VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password    VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro             BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at         TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key') THEN
        ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
    END IF;
END $$;

-- ============================================================
-- 5. watchlist (SINGULAR - this is what main.py queries)
-- ============================================================
CREATE TABLE IF NOT EXISTS watchlist (
    id BIGSERIAL PRIMARY KEY,
    user_id  BIGINT REFERENCES users(id)  ON DELETE CASCADE,
    movie_id BIGINT REFERENCES movies(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, movie_id)
);

-- Carry over rows from the old plural table, then retire it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_name = 'watchlists') THEN
        INSERT INTO watchlist (user_id, movie_id, added_at)
        SELECT user_id, movie_id, added_at FROM watchlists
        ON CONFLICT DO NOTHING;
        DROP TABLE watchlists;
    END IF;
END $$;

-- ============================================================
-- 6. payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    stripe_session_id VARCHAR(255) UNIQUE,
    amount INT,
    currency VARCHAR(10),
    status VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6b. search_log (free-tier quota, rolling 24h window)
-- ============================================================
CREATE TABLE IF NOT EXISTS search_log (
    id BIGSERIAL PRIMARY KEY,
    identity VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_log_identity_time
    ON search_log (identity, created_at DESC);

-- ============================================================
-- 7. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_movies_fts
    ON movies USING gin (fts_doc);
CREATE INDEX IF NOT EXISTS idx_movies_embedding
    ON movies USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_movies_catalog_year
    ON movies (catalog_source, release_year);
CREATE INDEX IF NOT EXISTS idx_movies_title_trgm
    ON movies USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_watchlist_user
    ON watchlist (user_id);
"""


def main():
    conn = psycopg2.connect(get_db_url())
    try:
        with conn.cursor() as cur:
            print("Applying schema...")
            cur.execute(SCHEMA_SQL)
            conn.commit()

            print("Backfilling fts_doc for existing rows...")
            cur.execute("UPDATE movies SET id = id;")  # fires the trigger
            conn.commit()

            cur.execute("SELECT count(*) FROM movies;")
            print(f"movies rows:    {cur.fetchone()[0]}")
            cur.execute("SELECT count(*) FROM users;")
            print(f"users rows:     {cur.fetchone()[0]}")
            cur.execute("SELECT count(*) FROM watchlist;")
            print(f"watchlist rows: {cur.fetchone()[0]}")
        print("Schema is up to date.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()