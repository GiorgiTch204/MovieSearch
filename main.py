import os
import json
import urllib.request
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from backend.mailer import send_notification
from dotenv import load_dotenv
from fastapi import FastAPI, Query, HTTPException, Depends, Request, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
import stripe
from passlib.context import CryptContext
from jose import JWTError, jwt
import base64
import re
from backend.notify import notify

load_dotenv()

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Password hashing configuration
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise RuntimeError(
        "SECRET_KEY missing or too short (need >= 32 chars). "
        "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
    )

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ----------------- PYDANTIC SCHEMAS -----------------
class RegisterRequest(BaseModel):
    email: str
    password: str
    username: Optional[str] = None
    

class LoginRequest(BaseModel):
    username_or_email: str
    password: str


# ----------------- HELPER FUNCTIONS -----------------
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def stripe_dict(obj) -> Dict[str, Any]:
    """stripe-python >= 8 returns StripeObject, which is NOT a dict and has no
    .get(). Convert the whole tree once, then treat it as ordinary data."""
    if isinstance(obj, dict):
        return obj
    to_dict = getattr(obj, "to_dict", None)
    return to_dict() if callable(to_dict) else dict(obj)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ----------------- FASTAPI SETUP -----------------
app = FastAPI(title="MovieSearch Pro API", version="2.0.0")

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from backend.encoder import OnnxEncoder

MODEL_DIR = os.getenv("MODEL_DIR", "models")
print("Loading int8 ONNX embedding model...")
model = OnnxEncoder(
    os.path.join(MODEL_DIR, "onnx", "model_quantized.onnx"),
    os.path.join(MODEL_DIR, "tokenizer.json"),
)

def get_db():
    raw_url = os.getenv("DATABASE_URL")
    if not raw_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL not set in environment")

    db_url = raw_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if "?" not in db_url:
        db_url += "?sslmode=require"
    elif "sslmode=" not in db_url:
        db_url += "&sslmode=require"

    conn = psycopg2.connect(db_url)
    try:
        yield conn
    finally:
        conn.close()


def get_current_user(token: str = Depends(oauth2_scheme), conn=Depends(get_db)) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id, username, email, is_pro, is_admin, created_at, "
            "(avatar IS NOT NULL) AS has_avatar, avatar_updated_at "
            "FROM users WHERE id = %s;",
            
            
            (int(user_id),),
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user

    

def get_admin_user(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """Like get_current_user, but 403s for anyone who is not an admin."""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def format_movie_item(row: Dict[str, Any], score: float) -> Dict[str, Any]:
    title = row.get("title_ka") or row.get("title") or "Untitled"

    rel_year = row.get("release_year")
    rel_date = row.get("release_date")
    if rel_year:
        year_str = str(rel_year)
    elif rel_date:
        year_str = str(rel_date)[:4]
    else:
        year_str = "N/A"

    overview = row.get("overview")
    if not overview or str(overview).strip().lower() in ["none", "nan", ""]:
        parts = []
        if row.get("director"):
            parts.append(f"Director: {row['director']}")
        if row.get("cast_members"):
            cast_preview = ", ".join(str(row["cast_members"]).split(",")[:4])
            parts.append(f"Cast: {cast_preview}")
        if row.get("studio"):
            parts.append(f"Studio: {row['studio']}")
        overview = ". ".join(parts) if parts else "Archive collection"

    raw_poster = row.get("poster_url") or row.get("poster_path")
    poster_src = None
    if raw_poster and "nophoto" not in str(raw_poster).lower():
        if str(raw_poster).startswith("http"):
            poster_src = str(raw_poster)
        else:
            poster_src = f"https://image.tmdb.org/t/p/w500{raw_poster}"

    match_pct = int(min(99, max(25, score * 100)))

    return {
        "id": row.get("id"),
        "source_id": row.get("source_id"),
        "catalog_source": row.get("catalog_source", "tmdb"),
        "title": title,
        "title_ka": row.get("title_ka"),
        "release_year": rel_year,
        "release_date": year_str,
        "vote_average": row.get("vote_average"),
        "genre": row.get("genre"),
        "overview": overview,
        "director": row.get("director"),
        "cast": row.get("cast_members"),
        "studio": row.get("studio"),
        "poster_path": poster_src,
        "poster_url": poster_src,
        "match_score": match_pct,
    }


# ----------------- FREE-TIER QUOTA -----------------
FREE_SEARCH_LIMIT = int(os.getenv("FREE_SEARCH_LIMIT", 20))


def get_optional_user(request: Request, conn=Depends(get_db)):
    """Like get_current_user, but returns None instead of raising 401."""
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    try:
        payload = jwt.decode(auth.split(" ", 1)[1], SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id, username, email, is_pro FROM users WHERE id = %s;",
            (int(user_id),),
        )
        return cur.fetchone()


def client_ip(request: Request) -> str:
    """Render sits behind a proxy, so the socket address is the proxy's."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def log_search(conn, identity: str, query, catalog) -> None:
    """Record one search. Every search is logged (Pro included) so the admin
    dashboard sees the whole picture; only the LIMIT is free-tier only."""
    text = (query or "").strip()[:300] or None
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO search_log (identity, query, catalog) VALUES (%s, %s, %s);",
            (identity, text, catalog),
        )
        conn.commit()


def consume_quota(conn, user, request: Request, query=None, catalog=None) -> Dict[str, Any]:
    """Record one search and return quota state. Raises 429 when exhausted."""
    identity = f"user:{user['id']}" if user else f"ip:{client_ip(request)}"

    if user and user.get("is_pro"):
        log_search(conn, identity, query, catalog)
        return {"unlimited": True, "used": 0, "limit": None}

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT count(*) FROM search_log
            WHERE identity = %s AND created_at > now() - interval '24 hours';
            """,
            (identity,),
        )
        used = cur.fetchone()[0]

        if used >= FREE_SEARCH_LIMIT:
            conn.commit()
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Free limit of {FREE_SEARCH_LIMIT} searches per 24 hours "
                    "reached. Upgrade to Pro for unlimited search."
                ),
            )
        conn.commit()

    log_search(conn, identity, query, catalog)

    # Housekeeping: keep ~6 months of history for the admin dashboard.
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM search_log "
            "WHERE created_at < now() - interval '180 days' AND random() < 0.05;"
        )
        conn.commit()

    return {"unlimited": False, "used": used + 1, "limit": FREE_SEARCH_LIMIT}

# ----------------- SEARCH ENDPOINTS -----------------
@app.get("/search")
@app.get("/api/search")
@app.get("/api/movies/search")
def search_movies(
    q: str = Query(..., min_length=1),
    semantic_weight: float = Query(0.25, ge=0.0, le=1.0),
    catalog: Optional[str] = Query(None),
    genre: Optional[str] = Query(None),
    era: Optional[str] = Query(None),
    min_rating: Optional[float] = Query(None),
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    conn=Depends(get_db),
    request: Request = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    try:
        quota = consume_quota(conn, current_user, request, query=q, catalog=catalog)
        kw_weight = max(0.01, 1.0 - semantic_weight)
        sem_weight = max(0.01, semantic_weight)

        q_emb = model.encode(q, normalize_embeddings=True).tolist()
        vec_str = f"[{','.join(str(x) for x in q_emb)}]"

        year_min, year_max = None, None
        if era == "before_1990":
            year_max = 1989
        elif era == "1990s":
            year_min, year_max = 1990, 1999
        elif era == "2000s":
            year_min, year_max = 2000, 2009
        elif era == "2010_plus":
            year_min = 2010

        sql = """
        WITH semantic_search AS (
            SELECT id, 
                   RANK() OVER (ORDER BY embedding <=> %(vec)s::vector) AS rank_semantic,
                   (1.0 - (embedding <=> %(vec)s::vector)) AS sim_score
            FROM movies
            WHERE (%(catalog)s IS NULL OR catalog_source = %(catalog)s)
              AND (%(year_min)s IS NULL OR release_year >= %(year_min)s)
              AND (%(year_max)s IS NULL OR release_year <= %(year_max)s)
              AND (%(genre)s IS NULL OR genre ILIKE %(genre_like)s)
              AND (%(min_rating)s IS NULL OR vote_average >= %(min_rating)s OR vote_average IS NULL)
            LIMIT 60
        ),
        text_search AS (
            SELECT id, 
                   RANK() OVER (ORDER BY ts_rank_cd(fts_doc, plainto_tsquery('simple', %(q)s)) DESC) AS rank_text,
                   ts_rank_cd(fts_doc, plainto_tsquery('simple', %(q)s)) AS text_score
            FROM movies
            WHERE (
                fts_doc @@ plainto_tsquery('simple', %(q)s) 
                OR title ILIKE %(q_like)s 
                OR title_ka ILIKE %(q_like)s
                OR director ILIKE %(q_like)s
            )
              AND (%(catalog)s IS NULL OR catalog_source = %(catalog)s)
              AND (%(year_min)s IS NULL OR release_year >= %(year_min)s)
              AND (%(year_max)s IS NULL OR release_year <= %(year_max)s)
              AND (%(genre)s IS NULL OR genre ILIKE %(genre_like)s)
              AND (%(min_rating)s IS NULL OR vote_average >= %(min_rating)s OR vote_average IS NULL)
            LIMIT 60
        )
        SELECT 
            m.*,
            (
                COALESCE((%(sem_w)s * (1.0 / (60 + s.rank_semantic))), 0.0) +
                COALESCE((%(kw_w)s * (1.0 / (60 + t.rank_text))), 0.0)
            ) AS hybrid_score,
            COALESCE(s.sim_score, 0.45) AS raw_sim
        FROM movies m
        LEFT JOIN semantic_search s ON m.id = s.id
        LEFT JOIN text_search t ON m.id = t.id
        WHERE s.id IS NOT NULL OR t.id IS NOT NULL
        ORDER BY hybrid_score DESC
        LIMIT %(limit)s OFFSET %(offset)s;
        """

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                sql,
                {
                    "vec": vec_str,
                    "q": q,
                    "q_like": f"%{q}%",
                    "sem_w": sem_weight,
                    "kw_w": kw_weight,
                    "catalog": catalog,
                    "genre": genre,
                    "genre_like": f"%{genre}%" if genre else None,
                    "year_min": year_min,
                    "year_max": year_max,
                    "min_rating": min_rating,
                    "limit": limit,
                    "offset": offset,
                },
            )
            rows = cur.fetchall()

        movies = []
        for r in rows:
            raw_sim = float(r.get("raw_sim", 0.45))
            boost = 0.25 if r.get("hybrid_score", 0) > 0.012 else 0.05
            final_score = min(0.98, raw_sim + boost)
            movies.append(format_movie_item(r, final_score))

        return {"results": movies, "total": len(movies), "quota": quota}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Search Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ----------------- MOVIE DETAIL ENDPOINTS -----------------
@app.get("/api/movies/{movie_id}")
def get_movie_details(movie_id: int, conn=Depends(get_db)):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT * FROM movies WHERE id = %s;", (movie_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Movie not found")

        movie = format_movie_item(row, 1.0)

        trailer_key = None
        cast_list = []
        backdrop_path = row.get("backdrop_path")

        target_tmdb_id = (
            row.get("source_id")
            or row.get("tmdb_id")
            or (row.get("id") if row.get("catalog_source") == "tmdb" else None)
        )

        tmdb_key = os.getenv("TMDB_API_KEY")

        if row.get("catalog_source") == "tmdb" and target_tmdb_id and tmdb_key:
            try:
                # 1. Fetch live YouTube trailer
                url = f"https://api.themoviedb.org/3/movie/{target_tmdb_id}/videos?api_key={tmdb_key}"
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    vdata = json.loads(resp.read().decode())
                    results = vdata.get("results", [])
                    for v in results:
                        if v.get("site") == "YouTube" and v.get("type") in ["Trailer", "Teaser"]:
                            trailer_key = v.get("key")
                            break
                    if not trailer_key and results:
                        for v in results:
                            if v.get("site") == "YouTube":
                                trailer_key = v.get("key")
                                break

                # 2. Fetch backdrop and cast credits
                url_c = f"https://api.themoviedb.org/3/movie/{target_tmdb_id}?api_key={tmdb_key}&append_to_response=credits"
                req_c = urllib.request.Request(url_c, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req_c, timeout=4) as resp:
                    ddata = json.loads(resp.read().decode())
                    if not backdrop_path:
                        backdrop_path = ddata.get("backdrop_path")
                    if ddata.get("credits", {}).get("cast"):
                        cast_list = [c["name"] for c in ddata["credits"]["cast"][:6]]
            except Exception as e:
                print(f"TMDb API lookup error: {e}")

        # Fallback cast parsing for Georgian/Archive films
        if not cast_list and row.get("cast_members"):
            cast_list = [c.strip() for c in str(row["cast_members"]).split(",") if c.strip()][:6]

        return {
            **movie,
            "trailer": trailer_key,
            "backdrop_path": backdrop_path,
            "cast": cast_list,
            "genres": [g.strip() for g in str(row.get("genre") or "").split(",") if g.strip()],
        }


@app.get("/api/movies/{movie_id}/similar")
def get_similar_movies(movie_id: int, conn=Depends(get_db)):
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, embedding, catalog_source, genre FROM movies WHERE id = %s;", (movie_id,))
            target = cur.fetchone()

            if not target:
                return []

            target_embedding = target.get("embedding")

            if target_embedding is not None:
                sql = """
                SELECT m.*, (1.0 - (m.embedding <=> %s::vector)) AS sim_score
                FROM movies m
                WHERE m.id != %s
                  AND m.embedding IS NOT NULL
                ORDER BY m.embedding <=> %s::vector ASC
                LIMIT 6;
                """
                cur.execute(sql, (target_embedding, movie_id, target_embedding))
                rows = cur.fetchall()
            else:
                genre = target.get("genre")
                sql = """
                SELECT m.*, 0.75 AS sim_score
                FROM movies m
                WHERE m.id != %s
                  AND (%s IS NULL OR m.genre ILIKE %s)
                ORDER BY m.vote_average DESC NULLS LAST
                LIMIT 6;
                """
                genre_match = f"%{genre.split(',')[0].strip()}%" if genre else None
                cur.execute(sql, (movie_id, genre_match, genre_match))
                rows = cur.fetchall()

            return [format_movie_item(r, float(r.get("sim_score", 0.8))) for r in rows]

    except Exception as e:
        print(f"Error fetching similar movies for ID {movie_id}: {e}")
        return []


# ----------------- WATCHLIST ENDPOINTS -----------------
@app.get("/api/watchlist")
def get_watchlist(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn=Depends(get_db),
):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT m.*
            FROM watchlist w
            JOIN movies m ON m.id = w.movie_id
            WHERE w.user_id = %s
            ORDER BY w.added_at DESC;
            """,
            (current_user["id"],),
        )
        rows = cur.fetchall()
    return [format_movie_item(r, 1.0) for r in rows]


@app.post("/api/watchlist/{movie_id}")
def add_to_watchlist(
    movie_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn=Depends(get_db),
):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO watchlist (user_id, movie_id)
            VALUES (%s, %s)
            ON CONFLICT (user_id, movie_id) DO NOTHING;
            """,
            (current_user["id"], movie_id),
        )
        conn.commit()
    return {"status": "added", "movie_id": movie_id}


@app.delete("/api/watchlist/{movie_id}")
def remove_from_watchlist(
    movie_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn=Depends(get_db),
):
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM watchlist WHERE user_id = %s AND movie_id = %s;",
            (current_user["id"], movie_id),
        )
        conn.commit()
    return {"status": "removed", "movie_id": movie_id}



# ----------------- STRIPE / PAYMENTS -----------------
@app.post("/api/checkout/create-session")
def create_checkout_session(current_user: Dict[str, Any] = Depends(get_current_user)):
    if current_user.get("is_pro"):
        raise HTTPException(400, "You already have Pro access")
    secret_key = os.getenv("STRIPE_SECRET_KEY")
    if not secret_key or not secret_key.startswith("sk_"):
        print("[Stripe Error] STRIPE_SECRET_KEY is missing or contains placeholder text in .env")
        raise HTTPException(
            status_code=500,
            detail="Stripe secret key not configured in .env file.",
        )

    stripe.api_key = secret_key
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")

    try:
        checkout_session = stripe.checkout.Session.create(
            customer_email=current_user["email"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": "MovieSearch Pro Pass",
                            "description": "Unlimited Semantic AI Search & Georgian Archive Access",
                        },
                        "unit_amount": 999,  # $9.99 USD in cents
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            metadata={
                "user_id": str(current_user["id"]),
            },
            client_reference_id=str(current_user["id"]),
            success_url=f"{frontend_url}?payment=success&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}?payment=cancelled",
        )
        return {"url": checkout_session.url}
    except Exception as e:
        print(f"[Stripe Checkout Error]: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request, conn=Depends(get_db)):
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not webhook_secret:
        print("[Stripe] STRIPE_WEBHOOK_SECRET is not set - refusing to process webhook.")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except Exception as e:
        print(f"Webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook payload or signature")

    
    # stripe-python >= 8 returns StripeObject, which is NOT a dict and has no
    # .get(). Convert the whole tree once, then the code below works as written.
    event = stripe_dict(event)

    if event.get("type") == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("metadata", {}).get("user_id")

        if session.get("payment_status") != "paid":
            print(f"[webhook] ignoring unpaid session {session.get('id')}")
            return {"status": "ignored"}

        if not user_id:
            print("[webhook] no user_id in metadata, nothing to do")
            return {"status": "no user"}

        # --- the part that must succeed ---
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE users SET is_pro = TRUE WHERE id = %s;",
                    (int(user_id),),
                )
                cur.execute(
                    """
                    INSERT INTO payments
                        (user_id, stripe_session_id, amount, currency, status)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (stripe_session_id) DO NOTHING;
                    """,
                    (
                        int(user_id),
                        session.get("id"),
                        session.get("amount_total"),
                        session.get("currency"),
                        session.get("payment_status"),
                    ),
                )
                first_time = cur.fetchone() is not None
            conn.commit()
            print(f"[webhook] user {user_id} upgraded to Pro")
        except Exception:
            conn.rollback()
            import traceback
            print("[webhook] DATABASE STEP FAILED:")
            traceback.print_exc()
            raise HTTPException(500, "Database error while upgrading user")

        # --- the part that may fail harmlessly ---
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT username, email FROM users WHERE id = %s;",
                    (int(user_id),),
                )
                row = cur.fetchone()
            uname = row[0] if row else "unknown"
            uemail = row[1] if row else "unknown"

            if first_time:
                amount = f"{(session.get('amount_total') or 0) / 100:.2f} {(session.get('currency') or '').upper()}"
                notify(
                    subject=f"MovieSearch Pro purchase - {current_user['email']}",
                    body=(
                        f"Username: {current_user.get('username') or '-'}\n"
                        f"Email:    {current_user['email']}\n"
                        f"Amount:   {amount}\n"
                        f"Session:  {session.get('id')}\n"
                    ),
                    title=f"Pro purchase - {amount}",
                    subtitle="Payment received",
                    rows=[
                        ("Username", current_user.get("username") or "-"),
                        ("Email", current_user["email"]),
                        ("User ID", f"#{current_user['id']}"),
                        ("Amount", amount),
                        ("Session", session.get("id")),
                    ],
                    accent="#059669",
                )
        except Exception as e:
            print(f"[webhook] notification step failed (ignored): {e}")

    return {"status": "success"}


# ----------------- AUTHENTICATION ENDPOINTS -----------------
@app.post("/api/auth/register")
def register(payload: RegisterRequest, conn=Depends(get_db)):
    email = payload.email.strip().lower()
    if not email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id FROM users WHERE email = %s;", (email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="User with this email already exists")

        hashed = get_password_hash(payload.password)
        cur.execute(
            """
            INSERT INTO users (username, email, hashed_password, is_pro) 
            VALUES (%s, %s, %s, FALSE) 
            RETURNING id, username, email, is_pro;
            """,
            (payload.username, email, hashed),
        )
        user = cur.fetchone()
        conn.commit()

    notify(
        subject=f"New MovieSearch signup: {user['email']}",
        body=(
            f"Username: {user.get('username') or '-'}\n"
            f"Email:    {user['email']}\n"
            f"User ID:  {user['id']}\n"
        ),
        title="New account registered",
        subtitle="Account activity",
        rows=[
            ("Username", user.get("username") or "-"),
            ("Email", user["email"]),
            ("User ID", f"#{user['id']}"),
        ],
        accent="#2563eb",
    )

    token = create_access_token({"sub": str(user["id"]), "email": user["email"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user.get("username"),
            "email": user["email"],
            "is_pro": user["is_pro"],
            "has_avatar": False,
        },
    }


@app.post("/api/auth/login")
def login(payload: LoginRequest, conn=Depends(get_db)):
    login_id = payload.username_or_email.strip().lower()

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, username, email, hashed_password, is_pro, is_admin,
                   created_at,
                   (avatar IS NOT NULL) AS has_avatar, avatar_updated_at
            FROM users 
            WHERE LOWER(email) = %s OR LOWER(username) = %s;
            """,
            (login_id, login_id),
        )
        user = cur.fetchone()

        if not user or not user.get("hashed_password"):
            raise HTTPException(status_code=401, detail="Invalid username/email or password")

        if not verify_password(payload.password, user["hashed_password"]):
            raise HTTPException(status_code=401, detail="Invalid username/email or password")

    token = create_access_token({"sub": str(user["id"]), "email": user["email"]})

    user_data = {
        "id": user["id"],
        "username": user.get("username"),
        "email": user["email"],
        "is_pro": user.get("is_pro", False),
        "created_at": user.get("created_at"),
        "has_avatar": user.get("has_avatar", False),
        "avatar_updated_at": user.get("avatar_updated_at"),
        "is_admin": user.get("is_admin", False),
    }

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_data,
    }


@app.get("/api/auth/me")
def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return current_user


@app.post("/api/auth/logout")
def logout():
    return {"message": "Logged out successfully"}

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


@app.patch("/api/auth/me")
def update_profile(
    payload: UpdateProfileRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn=Depends(get_db),
):
    updates, params = [], []

    if payload.username is not None:
        uname = payload.username.strip()
        if len(uname) < 3:
            raise HTTPException(400, "Username must be at least 3 characters")
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM users WHERE LOWER(username) = LOWER(%s) AND id <> %s;",
                (uname, current_user["id"]),
            )
            if cur.fetchone():
                raise HTTPException(400, "That username is already taken")
        updates.append("username = %s")
        params.append(uname)

    if payload.email is not None:
        email = payload.email.strip().lower()
        if "@" not in email or "." not in email:
            raise HTTPException(400, "Invalid email address")
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM users WHERE LOWER(email) = %s AND id <> %s;",
                (email, current_user["id"]),
            )
            if cur.fetchone():
                raise HTTPException(400, "That email is already registered")
        updates.append("email = %s")
        params.append(email)

    if payload.new_password:
        if len(payload.new_password) < 8:
            raise HTTPException(400, "New password must be at least 8 characters")
        if not payload.current_password:
            raise HTTPException(400, "Enter your current password to change it")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT hashed_password FROM users WHERE id = %s;",
                (current_user["id"],),
            )
            row = cur.fetchone()
        if not row or not verify_password(
            payload.current_password, row["hashed_password"]
        ):
            raise HTTPException(401, "Current password is incorrect")
        updates.append("hashed_password = %s")
        params.append(get_password_hash(payload.new_password))

    if not updates:
        raise HTTPException(400, "Nothing to update")

    params.append(current_user["id"])
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            f"UPDATE users SET {', '.join(updates)} WHERE id = %s "
            "RETURNING id, username, email, is_pro, created_at;",
            tuple(params),
        )
        user = cur.fetchone()
    conn.commit()
    return user

# ----------------- AVATARS -----------------
MAX_AVATAR_BYTES = 512 * 1024
ALLOWED_IMAGE_MIME = {"image/jpeg", "image/png", "image/webp"}
DATA_URL_RE = re.compile(
    r"^data:(image/[a-z+]+);base64,(.+)$", re.IGNORECASE | re.DOTALL
)


def sniff_image_mime(raw: bytes) -> Optional[str]:
    """Trust the bytes, not the declared type."""
    if raw.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    return None


class AvatarRequest(BaseModel):
    data_url: str


@app.put("/api/auth/me/avatar")
def set_avatar(
    payload: AvatarRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn=Depends(get_db),
):
    match = DATA_URL_RE.match(payload.data_url or "")
    if not match:
        raise HTTPException(400, "Expected a base64 image data URL")

    declared = match.group(1).lower()
    if declared not in ALLOWED_IMAGE_MIME:
        raise HTTPException(400, f"Unsupported image type: {declared}")

    try:
        raw = base64.b64decode(match.group(2), validate=True)
    except Exception:
        raise HTTPException(400, "Image data is not valid base64")

    if not raw:
        raise HTTPException(400, "Image is empty")
    if len(raw) > MAX_AVATAR_BYTES:
        raise HTTPException(413, "Image is larger than 512 KB")

    actual = sniff_image_mime(raw)
    if actual is None:
        raise HTTPException(400, "File does not look like a JPEG, PNG or WebP image")

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE users
            SET avatar = %s, avatar_mime = %s, avatar_updated_at = now()
            WHERE id = %s;
            """,
            (psycopg2.Binary(raw), actual, current_user["id"]),
        )
        conn.commit()

    return {"status": "ok", "mime": actual, "bytes": len(raw)}


@app.delete("/api/auth/me/avatar")
def delete_avatar(
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn=Depends(get_db),
):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET avatar = NULL, avatar_mime = NULL, "
            "avatar_updated_at = now() WHERE id = %s;",
            (current_user["id"],),
        )
        conn.commit()
    return {"status": "removed"}


@app.get("/api/users/{user_id}/avatar")
def get_avatar(user_id: int, conn=Depends(get_db)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT avatar, avatar_mime FROM users WHERE id = %s;", (user_id,)
        )
        row = cur.fetchone()

    if not row or not row[0]:
        raise HTTPException(404, "No avatar")

    return Response(
        content=bytes(row[0]),
        media_type=row[1] or "image/jpeg",
        headers={
            "Cache-Control": "public, max-age=300",
            "X-Content-Type-Options": "nosniff",
        },
    )


# ============================================================
# ADMIN  -- every route below is gated by get_admin_user
# ============================================================
@app.get("/api/admin/overview")
def admin_overview(
    _admin: Dict[str, Any] = Depends(get_admin_user),
    conn=Depends(get_db),
):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT
              (SELECT count(*) FROM users)                              AS total_users,
              (SELECT count(*) FROM users WHERE is_pro)                 AS pro_users,
              (SELECT count(*) FROM users WHERE is_admin)               AS admin_users,
              (SELECT count(*) FROM users
                 WHERE created_at > now() - interval '7 days')          AS new_users_7d,
              (SELECT count(*) FROM users
                 WHERE created_at > now() - interval '24 hours')        AS new_users_24h,
              (SELECT count(*) FROM search_log)                         AS total_searches,
              (SELECT count(*) FROM search_log
                 WHERE created_at > now() - interval '24 hours')        AS searches_24h,
              (SELECT count(DISTINCT identity) FROM search_log)         AS unique_searchers,
              (SELECT count(*) FROM watchlist)                          AS watchlist_items,
              (SELECT count(*) FROM movies)                             AS total_movies,
              (SELECT count(*) FROM movies
                 WHERE catalog_source = 'geocinema')                    AS georgian_movies,
              (SELECT coalesce(sum(amount), 0) FROM payments
                 WHERE status = 'paid')                                 AS revenue_cents,
              (SELECT count(*) FROM payments WHERE status = 'paid')     AS paid_count;
            """
        )
        stats = cur.fetchone()

        cur.execute(
            """
            SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
                   (SELECT count(*) FROM search_log s
                      WHERE s.created_at::date = d::date) AS searches,
                   (SELECT count(*) FROM users u
                      WHERE u.created_at::date = d::date) AS signups
            FROM generate_series(
                now() - interval '13 days', now(), interval '1 day'
            ) AS d
            ORDER BY day;
            """
        )
        daily = cur.fetchall()

    return {"stats": stats, "daily": daily}


@app.get("/api/admin/users")
def admin_users(
    q: Optional[str] = Query(None),
    plan: Optional[str] = Query(None),          # "pro" | "free"
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _admin: Dict[str, Any] = Depends(get_admin_user),
    conn=Depends(get_db),
):
    where, params = [], {}
    if q and q.strip():
        where.append("(u.username ILIKE %(q)s OR u.email ILIKE %(q)s)")
        params["q"] = f"%{q.strip()}%"
    if plan == "pro":
        where.append("coalesce(u.is_pro, FALSE) = TRUE")
    elif plan == "free":
        where.append("coalesce(u.is_pro, FALSE) = FALSE")
    clause = ("WHERE " + " AND ".join(where)) if where else ""

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"SELECT count(*) AS n FROM users u {clause};", params)
        total = cur.fetchone()["n"]

        params["lim"] = limit
        params["off"] = offset
        cur.execute(
            f"""
            SELECT u.id, u.username, u.email,
                   coalesce(u.is_pro,   FALSE) AS is_pro,
                   coalesce(u.is_admin, FALSE) AS is_admin,
                   u.created_at,
                   (u.avatar IS NOT NULL)      AS has_avatar,
                   u.avatar_updated_at,
                   (SELECT count(*) FROM watchlist w
                      WHERE w.user_id = u.id)                      AS watchlist_count,
                   (SELECT count(*) FROM search_log s
                      WHERE s.identity = 'user:' || u.id)          AS search_count,
                   (SELECT max(s.created_at) FROM search_log s
                      WHERE s.identity = 'user:' || u.id)          AS last_search,
                   (SELECT coalesce(sum(p.amount), 0) FROM payments p
                      WHERE p.user_id = u.id AND p.status = 'paid') AS paid_cents
            FROM users u
            {clause}
            ORDER BY u.created_at DESC NULLS LAST, u.id DESC
            LIMIT %(lim)s OFFSET %(off)s;
            """,
            params,
        )
        rows = cur.fetchall()

    return {"total": total, "limit": limit, "offset": offset, "users": rows}


class AdminUserUpdate(BaseModel):
    is_pro: Optional[bool] = None


@app.patch("/api/admin/users/{user_id}")
def admin_update_user(
    user_id: int,
    payload: AdminUserUpdate,
    _admin: Dict[str, Any] = Depends(get_admin_user),
    conn=Depends(get_db),
):
    """Grant or revoke Pro. Admin rights are deliberately NOT settable here --
    use backend/make_admin.py from a terminal."""
    if payload.is_pro is None:
        raise HTTPException(status_code=400, detail="Nothing to update")

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            UPDATE users SET is_pro = %s WHERE id = %s
            RETURNING id, username, email, coalesce(is_pro, FALSE) AS is_pro;
            """,
            (payload.is_pro, user_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        conn.commit()
        audit(conn, _admin, "grant_pro" if payload.is_pro else "revoke_pro",
          user_id, row["username"] or row["email"])

    return row


@app.get("/api/admin/payments")
def admin_payments(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _admin: Dict[str, Any] = Depends(get_admin_user),
    conn=Depends(get_db),
):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT count(*) AS n FROM payments;")
        total = cur.fetchone()["n"]

        cur.execute(
            """
            SELECT p.id, p.user_id, u.username, u.email,
                   p.amount, p.currency, p.status,
                   p.stripe_session_id, p.created_at
            FROM payments p
            LEFT JOIN users u ON u.id = p.user_id
            ORDER BY p.created_at DESC NULLS LAST, p.id DESC
            LIMIT %s OFFSET %s;
            """,
            (limit, offset),
        )
        rows = cur.fetchall()

    return {"total": total, "limit": limit, "offset": offset, "payments": rows}


@app.get("/api/admin/searches")
def admin_searches(
    limit: int = Query(60, ge=1, le=300),
    _admin: Dict[str, Any] = Depends(get_admin_user),
    conn=Depends(get_db),
):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, identity, query, catalog, created_at
            FROM search_log
            ORDER BY created_at DESC, id DESC
            LIMIT %s;
            """,
            (limit,),
        )
        recent = cur.fetchall()

        # Resolve "user:<id>" identities to names in a second pass, so no SQL
        # cast ever has to run against an "ip:..." identity.
        user_ids = []
        for row in recent:
            ident = row["identity"] or ""
            if ident.startswith("user:") and ident[5:].isdigit():
                user_ids.append(int(ident[5:]))

        names = {}
        if user_ids:
            cur.execute(
                "SELECT id, username, email FROM users WHERE id = ANY(%s);",
                (sorted(set(user_ids)),),
            )
            names = {r["id"]: r for r in cur.fetchall()}

        for row in recent:
            ident = row["identity"] or ""
            who = names.get(int(ident[5:])) if (
                ident.startswith("user:") and ident[5:].isdigit()
            ) else None
            row["username"] = who["username"] if who else None
            row["email"] = who["email"] if who else None

        cur.execute(
            """
            SELECT lower(btrim(query)) AS query,
                   count(*)            AS n,
                   max(created_at)     AS last_seen
            FROM search_log
            WHERE query IS NOT NULL AND btrim(query) <> ''
            GROUP BY 1
            ORDER BY n DESC, last_seen DESC
            LIMIT 20;
            """
        )
        top = cur.fetchall()

    return {"recent": recent, "top": top}



@app.get("/api/admin/users/{user_id}")
def admin_user_detail(
    user_id: int,
    _admin: Dict[str, Any] = Depends(get_admin_user),
    conn=Depends(get_db),
):
    """Everything stored about one account. Deliberately excludes
    hashed_password -- it is a one-way bcrypt hash, useless to read and a
    liability to expose."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT u.id, u.username, u.email,
                   coalesce(u.is_pro,   FALSE) AS is_pro,
                   coalesce(u.is_admin, FALSE) AS is_admin,
                   u.created_at,
                   u.stripe_customer_id,
                   (u.hashed_password IS NOT NULL) AS has_password,
                   (u.avatar IS NOT NULL)          AS has_avatar,
                   u.avatar_mime,
                   u.avatar_updated_at,
                   octet_length(u.avatar)          AS avatar_bytes
            FROM users u
            WHERE u.id = %s;
            """,
            (user_id,),
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        cur.execute(
            """
            SELECT m.id, coalesce(m.title_ka, m.title) AS title,
                   m.release_year, w.added_at
            FROM watchlist w
            JOIN movies m ON m.id = w.movie_id
            WHERE w.user_id = %s
            ORDER BY w.added_at DESC
            LIMIT 50;
            """,
            (user_id,),
        )
        watchlist = cur.fetchall()

        cur.execute(
            """
            SELECT id, amount, currency, status, stripe_session_id, created_at
            FROM payments
            WHERE user_id = %s
            ORDER BY created_at DESC NULLS LAST, id DESC;
            """,
            (user_id,),
        )
        payments = cur.fetchall()

        cur.execute(
            """
            SELECT id, query, catalog, created_at
            FROM search_log
            WHERE identity = %s
            ORDER BY created_at DESC, id DESC
            LIMIT 50;
            """,
            (f"user:{user_id}",),
        )
        searches = cur.fetchall()

    return {
        "user": user,
        "watchlist": watchlist,
        "payments": payments,
        "searches": searches,
    }


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    admin: Dict[str, Any] = Depends(get_admin_user),
    conn=Depends(get_db),
    
):
    """Permanently delete an account.

    watchlist rows cascade (ON DELETE CASCADE). payments rows survive with
    user_id set to NULL (ON DELETE SET NULL) so revenue history stays intact.
    search_log has no foreign key, so its rows are cleared by identity.
    """
    if user_id == admin["id"]:
        raise HTTPException(
            status_code=400, detail="You cannot delete the account you are signed in as"
        )

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id, username, email, coalesce(is_admin, FALSE) AS is_admin "
            "FROM users WHERE id = %s;",
            (user_id,),
        )
        target = cur.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        if target["is_admin"]:
            raise HTTPException(
                status_code=403,
                detail=(
                    "That account is an admin. Revoke its admin rights first "
                    "(in the account's Details panel), then delete it."
                ),
            )

        try:
            cur.execute(
                "DELETE FROM search_log WHERE identity = %s;", (f"user:{user_id}",)
            )
            searches_removed = cur.rowcount
            cur.execute("DELETE FROM users WHERE id = %s;", (user_id,))
            conn.commit()
        except psycopg2.errors.ForeignKeyViolation:
            conn.rollback()
            raise HTTPException(
                status_code=409,
                detail=(
                    "Another table still references this account and its foreign "
                    "key blocks deletion. Run backend/check_fks.py to see which."
                ),
            )
        except Exception as e:
            conn.rollback()
            print(f"[admin] delete failed for user {user_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Delete failed: {e}")

        audit(conn, admin, "delete_user", user_id,
          target["username"] or target["email"],
          f"{searches_removed} search rows removed")

    return {
        "status": "deleted",
        "id": target["id"],
        "username": target["username"],
        "email": target["email"],
        "searches_removed": searches_removed,
    }


class AdminPasswordReset(BaseModel):
    new_password: str


@app.post("/api/admin/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: int,
    payload: AdminPasswordReset,
    _admin: Dict[str, Any] = Depends(get_admin_user),
    conn=Depends(get_db),
):
    """Set a new password for an account. The old one is NOT recoverable --
    it was only ever stored as a bcrypt hash."""
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=400, detail="Password must be at least 6 characters"
        )

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            UPDATE users SET hashed_password = %s WHERE id = %s
            RETURNING id, username, email;
            """,
            (get_password_hash(payload.new_password), user_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        conn.commit()

        audit(conn, _admin, "reset_password", user_id, row["username"] or row["email"])

    return {"status": "password_set", **row}

def audit(conn, actor, action, target_id=None, target_label=None, detail=None):
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO admin_audit
                    (actor_id, actor_label, action, target_id, target_label, detail)
                VALUES (%s, %s, %s, %s, %s, %s);
                """,
                (actor["id"], actor.get("username") or actor.get("email"),
                 action, target_id, target_label, detail),
            )
            conn.commit()
    except Exception:
        # Never let a failed audit write break the action it describes.
        conn.rollback()


class AdminRoleUpdate(BaseModel):
    grant: bool
    password: str


@app.post("/api/admin/users/{user_id}/admin")
def admin_set_role(
    user_id: int,
    payload: AdminRoleUpdate,
    admin: Dict[str, Any] = Depends(get_admin_user),
    conn=Depends(get_db),
):
    if user_id == admin["id"]:
        raise HTTPException(
            status_code=400, detail="You cannot change your own admin rights"
        )

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT hashed_password FROM users WHERE id = %s;", (admin["id"],))
        me = cur.fetchone()
    if (not me or not me["hashed_password"]
            or not verify_password(payload.password, me["hashed_password"])):
        raise HTTPException(status_code=403, detail="That is not your password")

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id, username, email, coalesce(is_admin, FALSE) AS is_admin "
            "FROM users WHERE id = %s;", (user_id,))
        target = cur.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")

        if target["is_admin"] == payload.grant:
            raise HTTPException(
                status_code=400,
                detail=f"That account is already {'an admin' if payload.grant else 'a normal user'}",
            )

        if not payload.grant:
            cur.execute("SELECT count(*) AS n FROM users WHERE is_admin;")
            if cur.fetchone()["n"] <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="This is the last admin account. Promote someone else first.",
                )

        cur.execute(
            """
            UPDATE users SET is_admin = %s WHERE id = %s
            RETURNING id, username, email,
                      coalesce(is_pro, FALSE)   AS is_pro,
                      coalesce(is_admin, FALSE) AS is_admin;
            """,
            (payload.grant, user_id),
        )
        row = cur.fetchone()
        conn.commit()

    audit(conn, admin, "grant_admin" if payload.grant else "revoke_admin",
          user_id, target["username"] or target["email"])
    return row



@app.get("/api/admin/audit")
def admin_audit_log(
    limit: int = Query(60, ge=1, le=300),
    _admin: Dict[str, Any] = Depends(get_admin_user),
    conn=Depends(get_db),
):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, actor_id, actor_label, action,
                   target_id, target_label, detail, created_at
            FROM admin_audit
            ORDER BY created_at DESC, id DESC
            LIMIT %s;
            """,
            (limit,),
        )
        rows = cur.fetchall()
    return {"entries": rows}

class CheckoutConfirm(BaseModel):
    session_id: str


@app.post("/api/checkout/confirm")
def confirm_checkout(
    payload: CheckoutConfirm,
    current_user: Dict[str, Any] = Depends(get_current_user),
    conn=Depends(get_db),
):
    secret_key = os.getenv("STRIPE_SECRET_KEY")
    if not secret_key or not secret_key.startswith("sk_"):
        raise HTTPException(status_code=500, detail="Stripe secret key not configured")
    stripe.api_key = secret_key

    try:
        session = stripe_dict(stripe.checkout.Session.retrieve(payload.session_id))
    except Exception as e:
        print(f"[confirm] could not retrieve session {payload.session_id}: {e}")
        raise HTTPException(status_code=400, detail="Unknown checkout session")

    # The session must belong to the caller. Without this check anyone could
    # paste somebody else's session id and upgrade their own account.
    owner = (session.get("metadata") or {}).get("user_id")
    if str(owner) != str(current_user["id"]):
        raise HTTPException(
            status_code=403, detail="That checkout session belongs to another account"
        )

    if session.get("payment_status") != "paid":
        return {
            "status": session.get("payment_status") or "unpaid",
            "is_pro": bool(current_user.get("is_pro")),
        }

    with conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET is_pro = TRUE WHERE id = %s;", (current_user["id"],)
        )
        # RETURNING tells us whether this is the first time we have recorded
        # this checkout. The webhook may also process the same session, so the
        # insert is what decides who sends the alert -- exactly one of them.
        cur.execute(
            """
            INSERT INTO payments
                (user_id, stripe_session_id, amount, currency, status)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (stripe_session_id) DO NOTHING
            RETURNING id;
            """,
            (
                current_user["id"],
                session.get("id"),
                session.get("amount_total"),
                session.get("currency"),
                session.get("payment_status"),
            ),
        )
        first_time = cur.fetchone() is not None
        conn.commit()

    print(f"[confirm] user {current_user['id']} upgraded to Pro")

    if first_time:
        amount = f"{(session.get('amount_total') or 0) / 100:.2f} {(session.get('currency') or '').upper()}"
        notify(
            subject=f"MovieSearch Pro purchase - {current_user['email']}",
            body=(
                f"Username: {current_user.get('username') or '-'}\n"
                f"Email:    {current_user['email']}\n"
                f"Amount:   {amount}\n"
                f"Session:  {session.get('id')}\n"
            ),
            title=f"Pro purchase - {amount}",
            subtitle="Payment received",
            rows=[
                ("Username", current_user.get("username") or "-"),
                ("Email", current_user["email"]),
                ("User ID", f"#{current_user['id']}"),
                ("Amount", amount),
                ("Session", session.get("id")),
            ],
            accent="#059669",
        )

    return {"status": "paid", "is_pro": True}


# ----------------- CATALOGUE BROWSING -----------------
BROWSE_COLUMNS = """
    id, source_id, catalog_source, title, title_ka, release_year,
    release_date, vote_average, genre, overview, director,
    cast_members, studio, poster_url
"""

BROWSE_ORDER = {
    "newest": "release_year DESC NULLS LAST, id DESC",
    "oldest": "release_year ASC NULLS LAST, id ASC",
    "rating": "vote_average DESC NULLS LAST, id DESC",
    "title": "coalesce(title_ka, title) ASC NULLS LAST",
    "posters": "(poster_url IS NOT NULL AND poster_url NOT ILIKE '%%nophoto%%') DESC, "
               "release_year DESC NULLS LAST, id DESC",
}


@app.get("/api/movies")
def browse_movies(
    catalog: Optional[str] = Query(None),
    genre: Optional[str] = Query(None),
    sort: str = Query("posters"),
    page: int = Query(1, ge=1),
    per_page: int = Query(24, ge=1, le=60),
    conn=Depends(get_db),
):
    """Plain catalogue browsing: filter, sort, paginate.

    Deliberately does NOT call consume_quota. Paging through the catalogue is
    not a semantic search -- it runs no embedding and costs nothing to answer,
    so it must not eat anybody's free search allowance.

    Columns are listed explicitly rather than SELECT *: the movies table holds
    a 384-dimension embedding and a tsvector per row, and shipping those for
    24 rows a page would be megabytes of pure waste.

    The tab counts come back with every page rather than from their own route,
    because /api/movies/counts would be captured by the /api/movies/{movie_id}
    route registered above it and 422 on the int parse.
    """
    order = BROWSE_ORDER.get(sort, BROWSE_ORDER["posters"])

    where, params = [], {}
    if catalog in ("geocinema", "tmdb"):
        where.append("catalog_source = %(catalog)s")
        params["catalog"] = catalog
    if genre and genre.strip():
        where.append("genre ILIKE %(genre)s")
        params["genre"] = f"%{genre.strip()}%"
    clause = ("WHERE " + " AND ".join(where)) if where else ""

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT
              count(*)                                             AS all_movies,
              count(*) FILTER (WHERE catalog_source = 'geocinema') AS geocinema,
              count(*) FILTER (WHERE catalog_source IS DISTINCT FROM 'geocinema')
                                                                   AS tmdb
            FROM movies;
            """
        )
        counts = cur.fetchone()

        cur.execute(f"SELECT count(*) AS n FROM movies {clause};", params)
        total = cur.fetchone()["n"]

        pages = max(1, (total + per_page - 1) // per_page)
        page = min(page, pages)  # asking for page 900 of 50 returns the last one

        params["lim"] = per_page
        params["off"] = (page - 1) * per_page
        cur.execute(
            f"""
            SELECT {BROWSE_COLUMNS}
            FROM movies
            {clause}
            ORDER BY {order}
            LIMIT %(lim)s OFFSET %(off)s;
            """,
            params,
        )
        rows = cur.fetchall()

    return {
        "results": [format_movie_item(r, 0.8) for r in rows],
        "total": total,
        "page": page,
        "pages": pages,
        "per_page": per_page,
        "counts": counts,
    }