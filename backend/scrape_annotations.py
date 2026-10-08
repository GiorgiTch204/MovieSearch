"""Scrape the ANOTACIA (synopsis) for every Georgian film from geocinema.ge.

robots.txt is "User-agent: * / Disallow:" -- crawling is explicitly permitted.
We identify ourselves and rate-limit to ~1 request per second.

Pages are CACHED to data/geocinema_pages/. Re-running after a parser change
costs seconds instead of another full crawl. Delete the folder to force a
refetch.

Parser note: the film pages render the section headings (INFORMACIA /
MONAWILEOBEN / ANOTACIA / FESTIVALEBI) consecutively as tab labels, with the
content panes emitted afterwards. So "walk forward from the ANOTACIA heading"
does NOT work. Instead we take every <p> that is not site boilerplate.

    pip install beautifulsoup4
    python backend/scrape_annotations.py --test    # verify parser on 3 pages
    python backend/scrape_annotations.py           # full run
"""
import re
import sys
import time
from pathlib import Path

import psycopg2
import requests
import urllib3
from bs4 import BeautifulSoup
from psycopg2.extras import RealDictCursor, execute_batch
from tqdm import tqdm

from db_config import get_db_url

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

DELAY_SECONDS = 1.0
FLUSH_EVERY = 50
CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "geocinema_pages"
HEADERS = {
    "User-Agent": "MovieSearch-thesis-research/1.0 (IBSU student project)"
}

# Footer/sidebar text present on every page -- never part of a synopsis.
BOILERPLATE = (
    "geocinema.ge",
    "ყველა უფლება დაცულია",
    "საქართველოს კინემატოგრაფიის ეროვნული ცენტრი",
    "საიტზე განთავსებული ფოტო მასალა",
    "მივმართავთ რეჟისორებსა და პროდიუსერებს",
    "©",
)

H4_SKIP_PREFIXES = ("ხანგრძლივობა", "გამოშვების წელი", "პრემიერა")
STUDIO_MARKERS = ("სტუდია", "კინოსტუდია", "ტელეკომპანია", "შპს", "სს ")

UPDATE_SQL = """
    UPDATE movies
    SET overview   = COALESCE(%s, overview),
        genre_site = COALESCE(%s, genre_site)
    WHERE id = %s;
"""

TEST_URLS = [
    "http://geocinema.ge/ka/movies/505",
    "http://geocinema.ge/ka/movies/249",
    "http://geocinema.ge/ka/movies/118",
]


def connect():
    return psycopg2.connect(
        get_db_url(),
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
        connect_timeout=15,
    )


def flush(updates, retries: int = 4) -> int:
    if not updates:
        return 0
    for attempt in range(retries):
        try:
            conn = connect()
            try:
                with conn.cursor() as cur:
                    execute_batch(cur, UPDATE_SQL, updates, page_size=50)
                conn.commit()
            finally:
                conn.close()
            return len(updates)
        except psycopg2.OperationalError as e:
            wait = 3 * (attempt + 1)
            tqdm.write(f"  DB write failed ({e.__class__.__name__}), retry in {wait}s")
            time.sleep(wait)
    tqdm.write("  !! batch dropped -- re-run to pick it up")
    return 0


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def is_boilerplate(text: str) -> bool:
    low = text.lower()
    return any(b.lower() in low for b in BOILERPLATE)


def get_html(url: str, cache_key: str, session) -> str | None:
    """Return page HTML, from cache when available."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cached = CACHE_DIR / f"{cache_key}.html"
    if cached.exists():
        return cached.read_text(encoding="utf-8", errors="replace")

    resp = session.get(url, timeout=20, verify=False)
    if resp.status_code != 200:
        return None
    resp.encoding = resp.apparent_encoding or "utf-8"
    cached.write_text(resp.text, encoding="utf-8", errors="replace")
    time.sleep(DELAY_SECONDS)
    return resp.text


def soupify(html: str):
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return soup


def extract_annotation(soup) -> str | None:
    """Every <p> that isn't site boilerplate. The cast/crew blocks live in
    <div>s, so they are excluded automatically."""
    parts = []
    for p in soup.find_all("p"):
        text = clean(p.get_text(" ", strip=True))
        if len(text) < 25 or is_boilerplate(text):
            continue
        if text not in parts:
            parts.append(text)
    return " ".join(parts).strip() or None


def extract_genre(soup, known_studio) -> str | None:
    for h in soup.find_all("h4"):
        text = clean(h.get_text(" ", strip=True))
        if not text or len(text) > 60:
            continue
        if text.startswith(H4_SKIP_PREFIXES):
            continue
        if known_studio and text == clean(known_studio):
            continue
        if any(m in text for m in STUDIO_MARKERS) or '"' in text or "”" in text:
            continue
        return text
    return None


def run_test():
    print("Parser check on 3 pages (cached after the first run)\n")
    with requests.Session() as session:
        session.headers.update(HEADERS)
        for url in TEST_URLS:
            key = url.rstrip("/").split("/")[-1]
            html = get_html(url, f"test_{key}", session)
            if not html:
                print(f"{url}\n  FETCH FAILED\n")
                continue
            soup = soupify(html)
            overview = extract_annotation(soup)
            genre = extract_genre(soup, None)
            print(f"{url}")
            print(f"  genre:    {genre}")
            if overview:
                print(f"  overview: ({len(overview)} chars) {overview[:260]}...")
            else:
                print("  overview: *** NONE -- parser still broken ***")
            print()


def main():
    if "--test" in sys.argv:
        return run_test()

    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "ALTER TABLE movies ADD COLUMN IF NOT EXISTS genre_site VARCHAR(255);"
            )
            conn.commit()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, source_id, detail_url, studio
                FROM movies
                WHERE catalog_source = 'geocinema'
                  AND detail_url IS NOT NULL
                  AND overview IS NULL
                ORDER BY id;
            """)
            rows = cur.fetchall()
    finally:
        conn.close()

    if rows:
        cached_now = len(list(CACHE_DIR.glob("*.html"))) if CACHE_DIR.exists() else 0
        print(f"{len(rows)} rows to process ({cached_now} pages already cached).\n")

        updates, saved, no_annotation, failures = [], 0, 0, 0
        with requests.Session() as session:
            session.headers.update(HEADERS)
            for row in tqdm(rows, desc="scraping"):
                try:
                    html = get_html(
                        row["detail_url"], str(row["source_id"] or row["id"]), session
                    )
                    if not html:
                        failures += 1
                        continue
                    soup = soupify(html)
                    overview = extract_annotation(soup)
                    genre_site = extract_genre(soup, row.get("studio"))
                    if overview or genre_site:
                        updates.append((overview, genre_site, row["id"]))
                    if not overview:
                        no_annotation += 1
                except Exception:
                    failures += 1

                if len(updates) >= FLUSH_EVERY:
                    saved += flush(updates)
                    updates = []

        saved += flush(updates)
        print(f"\nrows written:                     {saved}")
        print(f"pages with no annotation section: {no_annotation}")
        print(f"fetch failures:                   {failures}")

    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT count(*), count(overview), count(genre),
                       count(genre_site), round(avg(length(overview)))
                FROM movies WHERE catalog_source = 'geocinema';
            """)
            t, ov, g, gs, avg = cur.fetchone()
            print(f"\ngeocinema rows:        {t}")
            print(f"  with overview:       {ov}  (avg {avg} chars)")
            print(f"  with genre (orig):   {g}")
            print(f"  with genre_site:     {gs}")
    finally:
        conn.close()

    print("\nNext: python backend/reembed.py")


if __name__ == "__main__":
    main()