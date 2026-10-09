"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Home,
  Film,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Globe,
  Clapperboard,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import { MovieModal } from "@/components/MovieModal";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const PER_PAGE = 24;

const TABS = [
  { id: "all", label: "All movies", icon: Film, countKey: "all_movies" },
  {
    id: "geocinema",
    label: "Georgian",
    icon: Clapperboard,
    countKey: "geocinema",
  },
  { id: "tmdb", label: "International", icon: Globe, countKey: "tmdb" },
];

const SORTS = [
  { id: "posters", label: "With posters first" },
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "rating", label: "Highest rated" },
  { id: "title", label: "Title A–Z" },
];

/**
 * Page numbers with gaps, so 269 pages don't render 269 buttons.
 * Always shows: first, last, current, and one either side of current.
 */
function pageList(current, total) {
  const keep = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (current >= total - 2)
    [total - 3, total - 2, total - 1].forEach((n) => keep.add(n));

  const nums = [...keep]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);

  const out = [];
  let prev = 0;
  for (const n of nums) {
    if (prev && n - prev > 1) out.push("gap-" + n);
    out.push(n);
    prev = n;
  }
  return out;
}

function MoviesBrowser() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL is the source of truth, so browser Back steps through pages and tabs,
  // and any view can be linked to or bookmarked.
  const catalog = searchParams.get("catalog") || "all";
  const sort = searchParams.get("sort") || "posters";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [user, setUser] = useState(null);

  const setParams = useCallback(
    (next) => {
      const p = new URLSearchParams(searchParams.toString());
      Object.entries(next).forEach(([k, v]) => {
        if (v === null || v === undefined || v === "all" || v === "")
          p.delete(k);
        else p.set(k, String(v));
      });
      router.push(`/movies?${p.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) return;
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => u && setUser(u))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");

    const p = new URLSearchParams({
      page: String(page),
      per_page: String(PER_PAGE),
      sort,
    });
    if (catalog !== "all") p.set("catalog", catalog);

    fetch(`${API_BASE}/api/movies?${p.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [catalog, sort, page]);

  const results = data?.results || [];
  const pages = data?.pages || 1;
  const total = data?.total || 0;
  const counts = data?.counts || {};

  return (
    <div className="min-h-screen bg-surface-0 text-ink flex flex-col font-sans">
      <Navbar user={user} />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* Navigation back */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-1 px-3 py-2 text-xs font-semibold text-ink-muted transition hover:text-ink hover:bg-surface-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-1 px-3 py-2 text-xs font-semibold text-ink-muted transition hover:text-ink hover:bg-surface-2"
          >
            <Home className="w-3.5 h-3.5" /> Main page
          </Link>
        </div>

        <header className="mb-5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
            Browse the catalogue
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {total.toLocaleString()} title{total === 1 ? "" : "s"}
            {catalog !== "all" ? " in this collection" : " in total"} · page{" "}
            {page} of {pages}
          </p>
        </header>

        {/* Category tabs */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {TABS.map((t) => {
            const active = catalog === t.id;
            const n = counts[t.countKey];
            return (
              <button
                key={t.id}
                onClick={() => setParams({ catalog: t.id, page: 1 })}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                  active
                    ? "border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                    : "border-line bg-surface-1 text-ink-muted hover:text-ink"
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                {typeof n === "number" && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      active ? "bg-white/20" : "bg-surface-2"
                    }`}
                  >
                    {n.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}

          <select
            value={sort}
            onChange={(e) => setParams({ sort: e.target.value, page: 1 })}
            className="ml-auto shrink-0 rounded-xl border border-line bg-surface-1 px-3 py-2 text-xs font-semibold text-ink focus:border-blue-500 focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Results */}
        {error ? (
          <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-ink-muted gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm">Loading page {page}…</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-24 text-ink-muted">
            <Film className="w-12 h-12 stroke-1 mx-auto mb-3" />
            <p className="text-base font-medium">
              Nothing in this collection yet.
            </p>
          </div>
        ) : (
          <>
            {/* 3 per row from sm up. Two on the narrowest phones, because three
                100px cards are unreadable. */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5">
              {results.map((movie) => (
                <MovieCard
                  key={movie.source_id || movie.id}
                  movie={movie}
                  onClick={() => setSelectedMovie(movie)}
                />
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <nav
                aria-label="Pagination"
                className="mt-8 flex flex-wrap items-center justify-center gap-1.5"
              >
                <button
                  onClick={() => setParams({ page: page - 1 })}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="rounded-lg border border-line bg-surface-1 p-2 text-ink-muted transition hover:text-ink disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {pageList(page, pages).map((n) =>
                  typeof n === "string" ? (
                    <span key={n} className="px-1.5 text-xs text-ink-muted">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setParams({ page: n })}
                      aria-current={n === page ? "page" : undefined}
                      className={`min-w-9 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        n === page
                          ? "border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                          : "border-line bg-surface-1 text-ink-muted hover:text-ink"
                      }`}
                    >
                      {n}
                    </button>
                  ),
                )}

                <button
                  onClick={() => setParams({ page: page + 1 })}
                  disabled={page >= pages}
                  aria-label="Next page"
                  className="rounded-lg border border-line bg-surface-1 p-2 text-ink-muted transition hover:text-ink disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </nav>
            )}
          </>
        )}
      </main>

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onSelectMovie={(m) => setSelectedMovie(m)}
          user={user}
          isInWatchlist={false}
          onToggleWatchlist={() => {}}
        />
      )}
    </div>
  );
}

/* useSearchParams() must sit inside a Suspense boundary in the App Router --
   without it `next build` fails outright, and this project has
   cacheComponents enabled, which enforces it more strictly. */
export default function MoviesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-0 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      }
    >
      <MoviesBrowser />
    </Suspense>
  );
}
