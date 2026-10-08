import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import sys

from db_config import get_db_url

MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
BATCH_SIZE = 64


def build_context(row) -> str:
    """One template for both catalogs.

    Field *values* only -- no language-specific label words like
    "Director:" / "rezhisori:", which would otherwise push Georgian and
    English rows apart for reasons that have nothing to do with content.
    """
    parts = [
        row.get("title"),
        row.get("title_ka"),
        str(row["release_year"]) if row.get("release_year") else None,
        row.get("genre"),
        row.get("director"),
        row.get("cast_members"),
        row.get("studio"),
        row.get("overview"),
    ]
    seen, out = set(), []
    for p in parts:
        p = (str(p).strip() if p is not None else "")
        if p and p.lower() not in ("none", "nan") and p not in seen:
            seen.add(p)
            out.append(p)
    return ". ".join(out)


def main():
    conn = psycopg2.connect(get_db_url())
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE movies SET catalog_source = 'tmdb'
                WHERE catalog_source IS NULL;
            """)
            if cur.rowcount:
                print(f"Backfilled catalog_source='tmdb' on {cur.rowcount} rows.")
            conn.commit()

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, title, title_ka, overview, genre, director,
                       cast_members, studio, release_year
                FROM movies
                ORDER BY id;
            """)
            rows = cur.fetchall()

        print(f"Loaded {len(rows)} movies.")
        texts = [build_context(r) for r in rows]

        if "--onnx" in sys.argv:
            from encoder import OnnxEncoder

            print("Loading int8 ONNX encoder (models/)...")
            model = OnnxEncoder(
                "models/onnx/model_quantized.onnx", "models/tokenizer.json"
            )
        else:
            from sentence_transformers import SentenceTransformer

            print(f"Loading {MODEL_NAME} fp32 (downloads ~470MB on first run)...")
            model = SentenceTransformer(MODEL_NAME)

        print("Encoding...")
        updates = []
        for i in tqdm(range(0, len(texts), BATCH_SIZE)):
            chunk = texts[i:i + BATCH_SIZE]
            embs = model.encode(
                chunk, normalize_embeddings=True, show_progress_bar=False
            )
            for row, emb in zip(rows[i:i + BATCH_SIZE], embs):
                vec = "[" + ",".join(str(x) for x in emb.tolist()) + "]"
                updates.append((vec, row["id"]))

        print(f"Writing {len(updates)} embeddings...")
        with conn.cursor() as cur:
            execute_batch(
                cur,
                "UPDATE movies SET embedding = %s::vector WHERE id = %s;",
                updates,
                page_size=200,
            )
            conn.commit()

        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM movies WHERE embedding IS NULL;")
            print(f"Rows still missing an embedding: {cur.fetchone()[0]}")

        print("Done. Both catalogs now share one vector space.")
    finally:
        conn.close()
    

if __name__ == "__main__":
    main()