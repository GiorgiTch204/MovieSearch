import os
import re
import numpy as np
from typing import List, Dict, Any, Optional
from sentence_transformers import SentenceTransformer
import psycopg2
from psycopg2.extras import RealDictCursor

# 1. მულტილინგვალური მოდელი ქართული და ინგლისური ენებისთვის
MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
model = SentenceTransformer(MODEL_NAME)

def get_query_embedding(query: str) -> List[float]:
    """აკეთებს მოთხოვნის ვექტორიზაციას 384 განზომილებაში."""
    emb = model.encode(query, normalize_embeddings=True)
    return emb.tolist()

def format_movie_response(row: Dict[str, Any], score: float) -> Dict[str, Any]:
    """
    აერთიანებს TMDb და Geocinema-ს მონაცემებს ერთიან ობიექტად Next.js-ისთვის.
    """
    # სათაური
    title = row.get("title_ka") or row.get("title") or "უსათაურო"
    
    # წელი
    rel_year = row.get("release_year")
    rel_date = row.get("release_date")
    if rel_year:
        year_str = str(rel_year)
    elif rel_date:
        year_str = str(rel_date)[:4]
    else:
        year_str = "N/A"

    # აღწერა (Overview) — თუ Geocinema-ს არ აქვს მოკლე შინაარსი, ვაჩვენებთ შემოქმედებით ჯგუფს
    overview = row.get("overview")
    if not overview or str(overview).strip() == "":
        parts = []
        if row.get("director"):
            parts.append(f"რეჟისორი: {row['director']}")
        if row.get("cast_members"):
            # მხოლოდ პირველი რამდენიმე მსახიობი მოკლე ანოტაციისთვის
            cast_preview = ", ".join(str(row["cast_members"]).split(",")[:5])
            parts.append(f"როლებში: {cast_preview}")
        if row.get("studio"):
            parts.append(f"სტუდია: {row['studio']}")
        overview = ". ".join(parts) if parts else "ქართული კინოკლასიკის არქივი"

    # პოსტერის მისამართი
    poster = row.get("poster_url") or row.get("poster_path")
    if poster and "nophoto" in str(poster).lower():
        poster = None
    elif poster and not str(poster).startswith("http"):
        # TMDb სურათების პრეფიქსი
        poster = f"https://image.tmdb.org/t/p/w500{poster}"

    # შესაბამისობის პროცენტი (UI-ს match_score-ისთვის)
    # RRF-ის ან კოსინუსური მსგავსების ქულა გადაგვყავს პროცენტში (0 - 100)
    match_percentage = min(100, max(10, int(score * 100)))

    return {
        "id": row.get("id"),
        "source_id": row.get("source_id"),
        "catalog_source": row.get("catalog_source", "tmdb"),
        "title": title,
        "title_ka": row.get("title_ka"),
        "release_year": rel_year,
        "release_date": year_str,
        "vote_average": row.get("vote_average") or None,
        "genre": row.get("genre"),
        "genres": row.get("genres"),
        "overview": overview,
        "director": row.get("director"),
        "cast": row.get("cast_members"),
        "studio": row.get("studio"),
        "poster_path": poster,
        "poster_url": poster,
        "match_score": match_percentage
    }

def execute_hybrid_search(
    conn,
    query_text: str,
    semantic_weight: float = 0.5,
    catalog: Optional[str] = None,
    genre: Optional[str] = None,
    era: Optional[str] = None,
    min_rating: Optional[float] = None,
    limit: int = 24,
    offset: int = 0
) -> List[Dict[str, Any]]:
    """
    ასრულებს მოქნილ ჰიბრიდულ ძიებას წონების მიხედვით (RRF + Filters).
    """
    keyword_weight = max(0.01, 1.0 - semantic_weight)
    semantic_weight = max(0.01, semantic_weight)

    query_emb = get_query_embedding(query_text)
    vector_str = f"[{','.join(str(x) for x in query_emb)}]"

    # ფილტრების ლოგიკა (Era / წლები)
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
        SELECT id, RANK() OVER (ORDER BY embedding <=> %(vec)s::vector) AS rank_semantic,
               (1.0 - (embedding <=> %(vec)s::vector)) AS sim_score
        FROM movies
        WHERE (%(catalog)s IS NULL OR catalog_source = %(catalog)s)
          AND (%(year_min)s IS NULL OR release_year >= %(year_min)s)
          AND (%(year_max)s IS NULL OR release_year <= %(year_max)s)
          AND (%(min_rating)s IS NULL OR vote_average >= %(min_rating)s OR vote_average IS NULL)
        LIMIT 60
    ),
    text_search AS (
        SELECT id, RANK() OVER (ORDER BY ts_rank_cd(fts_doc, plainto_tsquery('simple', %(q)s)) DESC) AS rank_text,
               ts_rank_cd(fts_doc, plainto_tsquery('simple', %(q)s)) AS text_score
        FROM movies
        WHERE (fts_doc @@ plainto_tsquery('simple', %(q)s) 
               OR title ILIKE %(q_like)s 
               OR title_ka ILIKE %(q_like)s)
          AND (%(catalog)s IS NULL OR catalog_source = %(catalog)s)
          AND (%(year_min)s IS NULL OR release_year >= %(year_min)s)
          AND (%(year_max)s IS NULL OR release_year <= %(year_max)s)
          AND (%(min_rating)s IS NULL OR vote_average >= %(min_rating)s OR vote_average IS NULL)
        LIMIT 60
    )
    SELECT 
        m.*,
        (
            COALESCE((%(sem_w)s * (1.0 / (60 + s.rank_semantic))), 0.0) +
            COALESCE((%(kw_w)s * (1.0 / (60 + t.rank_text))), 0.0)
        ) AS hybrid_score,
        COALESCE(s.sim_score, 0.4) AS raw_sim
    FROM movies m
    LEFT JOIN semantic_search s ON m.id = s.id
    LEFT JOIN text_search t ON m.id = t.id
    WHERE s.id IS NOT NULL OR t.id IS NOT NULL
    ORDER BY hybrid_score DESC
    LIMIT %(limit)s OFFSET %(offset)s;
    """

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, {
            "vec": vector_str,
            "q": query_text,
            "q_like": f"%{query_text}%",
            "sem_w": semantic_weight,
            "kw_w": keyword_weight,
            "catalog": catalog,
            "year_min": year_min,
            "year_max": year_max,
            "min_rating": min_rating,
            "limit": limit,
            "offset": offset
        })
        rows = cur.fetchall()

    results = []
    for r in rows:
        # ნორმალიზებული ქულა პროცენტული მაჩვენებლისთვის
        # RRF ქულა დაბალი რიცხვია (0.005 - 0.03), ამიტომ მას ვამრავლებთ სემანტიკურ სიახლოვეზე
        display_score = max(0.35, min(0.98, float(r.get("raw_sim", 0.5)) + (0.2 if r.get("hybrid_score", 0) > 0.015 else 0.0)))
        results.append(format_movie_response(r, display_score))

    return results

# Backward compatibility aliases for main.py imports
if "execute_hybrid_search" in globals():
    search_movies_hybrid = execute_hybrid_search

def get_similar_movies(*args, **kwargs):
    """Stub in case main.py imports similar movies logic."""
    return []