import re
import sys

import requests
import urllib3
from bs4 import BeautifulSoup

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

SAMPLES = [
    "http://geocinema.ge/ka/movies/505",
    "http://geocinema.ge/ka/movies/249",   # mxiaruli romani (comedy)
    "http://geocinema.ge/ka/movies/118",   # keto da kote
]

HEADERS = {
    "User-Agent": "MovieSearch-thesis-research/1.0 (IBSU student project)"
}


def fetch(url: str):
    resp = requests.get(url, headers=HEADERS, timeout=20, verify=False)
    resp.encoding = resp.apparent_encoding or "utf-8"
    return resp


def main():
    print("=== robots.txt ===")
    try:
        r = fetch("http://geocinema.ge/robots.txt")
        print(f"[{r.status_code}]")
        print(r.text[:800] if r.status_code == 200 else "(none)")
    except Exception as e:
        print(f"could not fetch: {e}")

    for url in SAMPLES:
        print(f"\n\n{'=' * 70}\n{url}\n{'=' * 70}")
        try:
            resp = fetch(url)
        except Exception as e:
            print(f"FAILED: {e}")
            continue

        print(f"status={resp.status_code}  bytes={len(resp.content)}")
        if resp.status_code != 200:
            continue

        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()

        title = soup.find("title")
        print(f"<title>: {title.get_text(strip=True) if title else '-'}")

        meta = soup.find("meta", attrs={"name": "description"})
        if meta:
            print(f"<meta description>: {meta.get('content', '')[:300]}")

        print("\n--- text blocks longer than 80 chars ---")
        found = False
        for el in soup.find_all(["p", "div", "span", "td", "article", "section"]):
            # Only leaf-ish nodes, so we don't print the whole page body
            if el.find(["p", "div", "article", "section"]):
                continue
            text = re.sub(r"\s+", " ", el.get_text(" ", strip=True))
            if len(text) > 80:
                found = True
                cls = " ".join(el.get("class") or []) or "-"
                print(f"\n  <{el.name} class='{cls}' id='{el.get('id', '-')}'>")
                print(f"  {text[:400]}")
        if not found:
            print("  (none - page may be JavaScript-rendered)")

        print("\n--- all headings ---")
        for h in soup.find_all(["h1", "h2", "h3", "h4"]):
            t = h.get_text(" ", strip=True)
            if t:
                print(f"  <{h.name}> {t[:120]}")


if __name__ == "__main__":
    sys.exit(main())