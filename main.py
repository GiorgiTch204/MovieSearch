import os
import json
import urllib.request
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from backend.mailer import send_notification
from dotenv import load_dotenv
from fastapi import FastAPI, Query, HTTPException, Depends, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
import stripe
from passlib.context import CryptContext
from jose import JWTError, jwt

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
        cur.execute("SELECT id, username, email, is_pro FROM users WHERE id = %s;", (int(user_id),))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return user


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


def consume_quota(conn, user, request: Request) -> Dict[str, Any]:
    """Record one search and return quota state. Raises 429 when exhausted."""
    if user and user.get("is_pro"):
        return {"unlimited": True, "used": 0, "limit": None}

    identity = f"user:{user['id']}" if user else f"ip:{client_ip(request)}"

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

        cur.execute("INSERT INTO search_log (identity) VALUES (%s);", (identity,))
        cur.execute(
            "DELETE FROM search_log "
            "WHERE created_at < now() - interval '48 hours' AND random() < 0.05;"
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
        quota = consume_quota(conn, current_user, request)
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
    secret_key = os.getenv("STRIPE_SECRET_KEY")
    print(f"[Stripe] key present={bool(secret_key)} prefix={(secret_key or '')[:8]!r} len={len(secret_key or '')}")
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
    
    if event.get("type") == "checkout.session.completed":
            session = event["data"]["object"]
            user_id = session.get("metadata", {}).get("user_id")

            if session.get("payment_status") != "paid":
                print(f"Ignoring unpaid session {session.get('id')}")
                return {"status": "ignored"}

            if user_id:
                with conn.cursor() as cur:
                    cur.execute("UPDATE users SET is_pro = TRUE WHERE id = %s;", (int(user_id),))
                    cur.execute(
                        """
                        INSERT INTO payments (user_id, stripe_session_id, amount, currency, status)
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
                    conn.commit()
                    print(f"Payment successful: User {user_id} upgraded to Pro.")
                    cur.execute(
                        "SELECT username, email FROM users WHERE id = %s;",
                        (int(user_id),),
                    )
                    row = cur.fetchone()
                    uname = row[0] if row else "unknown"
                    uemail = row[1] if row else "unknown"

                    send_notification(
                        subject=f"MovieSearch Pro purchase - {uemail}",
                        body=(
                            f"A user upgraded to Pro.\n\n"
                            f"Username: {uname}\n"
                            f"Email:    {uemail}\n"
                            f"User ID:  {user_id}\n"
                            f"Amount:   {(session.get('amount_total') or 0) / 100:.2f} "
                            f"{(session.get('currency') or '').upper()}\n"
                            f"Session:  {session.get('id')}\n"
                            f"Livemode: {event.get('livemode')}\n"
                        ),
                    )

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

    token = create_access_token({"sub": str(user["id"]), "email": user["email"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user.get("username"),
            "email": user["email"],
            "is_pro": user["is_pro"],
        },
    }


@app.post("/api/auth/login")
def login(payload: LoginRequest, conn=Depends(get_db)):
    login_id = payload.username_or_email.strip().lower()

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id, username, email, hashed_password, is_pro 
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