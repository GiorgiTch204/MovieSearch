import json
import time
import urllib.parse
import urllib.request

API = "http://127.0.0.1:8000/api/search"
WEIGHTS = [0.0, 0.25, 0.5, 0.75, 1.0]
K = 10
TIMEOUT = 60

# (query, {genre terms in BOTH languages that mark relevance}, label)
QUERIES = [
    ("კომედია",     {"კომედია", "comedy"},         "comedy (KA)"),
    ("comedy",       {"კომედია", "comedy"},         "comedy (EN)"),
    ("დრამა",       {"დრამა", "drama"},            "drama (KA)"),
    ("drama",        {"დრამა", "drama"},            "drama (EN)"),
    ("დოკუმენტური", {"დოკუმენტური", "documentary"}, "documentary (KA)"),
    ("documentary",  {"დოკუმენტური", "documentary"}, "documentary (EN)"),
]


def search(query: str, weight: float, retries: int = 2):
    params = urllib.parse.urlencode(
        {"q": query, "semantic_weight": weight, "limit": K}
    )
    url = f"{API}?{params}"
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=TIMEOUT) as resp:
                return json.loads(resp.read().decode()).get("results", [])
        except Exception:
            if attempt == retries:
                raise
            time.sleep(2)
    return []


def judge(results, terms):
    """relevant, geocinema, tmdb, relevant_geo, relevant_tmdb"""
    rel = geo = tmdb = rel_geo = rel_tmdb = 0
    for r in results:
        genre = str(r.get("genre") or "").lower()
        is_rel = any(t.lower() in genre for t in terms)
        is_geo = r.get("catalog_source") == "geocinema"
        rel += is_rel
        geo += is_geo
        tmdb += not is_geo
        if is_rel and is_geo:
            rel_geo += 1
        if is_rel and not is_geo:
            rel_tmdb += 1
    return rel, geo, tmdb, rel_geo, rel_tmdb


def main():
    print("Warming up the API (first call loads the encoder)...")
    try:
        search("warmup", 0.5)
    except Exception as e:
        print(f"  warmup failed: {e}")

    # One pass, reused for every table below.
    data = {}
    for query, terms, label in QUERIES:
        for w in WEIGHTS:
            try:
                data[(label, w)] = judge(search(query, w), terms)
            except Exception as e:
                data[(label, w)] = None
                print(f"  {label} @ {w}: {e}")

    header = f"{'query':<18}" + "".join(f"{w:>9}" for w in WEIGHTS)

    def table(title, cell_fn):
        print(f"\n{title}\n")
        print(header)
        print("-" * len(header))
        for _, _, label in QUERIES:
            cells = []
            for w in WEIGHTS:
                d = data[(label, w)]
                cells.append("ERR" if d is None else cell_fn(d))
            print(f"{label:<18}" + "".join(f"{c:>9}" for c in cells))

    table(
        f"1. precision@{K}  (0.0 = pure keyword, 1.0 = pure vector)",
        lambda d: f"{d[0]}/{d[1] + d[2]}",
    )

    print("-" * len(header))
    n = len(QUERIES) * K
    totals = {
        w: sum(
            data[(l, w)][0] for _, _, l in QUERIES if data[(l, w)]
        )
        for w in WEIGHTS
    }
    print(f"{'TOTAL':<18}" + "".join(f"{totals[w]:>9}" for w in WEIGHTS))
    print(f"{'precision':<18}" + "".join(
        f"{totals[w] / n:>9.2f}" for w in WEIGHTS
    ))

    table("2. catalog split in top 10  (geocinema / tmdb)",
          lambda d: f"{d[1]}/{d[2]}")

    table("3. RELEVANT results by catalog  (geocinema / tmdb)",
          lambda d: f"{d[3]}/{d[4]}")
    print()


if __name__ == "__main__":
    main()