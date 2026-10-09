"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Film, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { AuthModal } from "@/components/AuthModal";
import MovieCard from "@/components/MovieCard";
import { MovieModal } from "@/components/MovieModal";
import FilterBar from "@/components/FilterBar";
import { PricingModal } from "@/components/PricingModal";

// const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState(null);

  // Unified Filter State
  const [filters, setFilters] = useState({
    catalog: "",
    genre: "",
    era: "",
    minRating: "",
    semanticWeight: 0.25,
  });

  const [isPricingOpen, setIsPricingOpen] = useState(false);

  const [watchlistIds, setWatchlistIds] = useState([]);
  const [quota, setQuota] = useState(null);
  const [quotaMessage, setQuotaMessage] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  // Restore the session from the stored token on first load
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((userData) => {
        if (userData) setUser(userData);
        else localStorage.removeItem("auth_token");
      })
      .catch(() => {});
  }, []);

  // Load the user's watchlist whenever the signed-in user changes
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!user || !token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWatchlistIds([]);
      return;
    }
    fetch(`${API_BASE}/api/watchlist`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setWatchlistIds(rows.map((m) => m.id)))
      .catch(() => {});
  }, [user]);

  const handleToggleWatchlist = async (movieId) => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setIsAuthOpen(true);
      return;
    }
    const inList = watchlistIds.includes(movieId);
    try {
      const res = await fetch(`${API_BASE}/api/watchlist/${movieId}`, {
        method: inList ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setWatchlistIds((prev) =>
          inList ? prev.filter((id) => id !== movieId) : [...prev, movieId],
        );
      }
    } catch (err) {
      console.error("Watchlist toggle failed:", err);
    }
  };

  const fetchMovies = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query.trim(),
        semantic_weight: filters.semanticWeight.toString(),
      });

      if (filters.catalog) params.append("catalog", filters.catalog);
      if (filters.genre) params.append("genre", filters.genre);
      if (filters.era) params.append("era", filters.era);
      if (filters.minRating)
        params.append("min_rating", filters.minRating.toString());

      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `${API_BASE}/api/movies/search?${params.toString()}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );

      if (res.status === 429) {
        const err = await res.json();
        setQuotaMessage(err.detail);
        setResults([]);
        return;
      }

      if (!res.ok) throw new Error("Search request failed");

      const data = await res.json();
      setResults(data.results || []);
      setQuota(data.quota || null);
      setQuotaMessage("");
    } catch (err) {
      console.error("Fetch error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, filters]);

  // Debounced auto-search when typing or toggling filters
  useEffect(() => {
    if (query.trim()) {
      const timer = setTimeout(() => {
        fetchMovies();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [query, filters, fetchMovies]);

  // Returning from Stripe. Rather than polling and hoping the webhook has
  // landed, hand the session id back to our API, which asks Stripe directly
  // whether it was paid. The webhook remains the backstop for people who
  // close the tab before being redirected here.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("payment") !== "success") return;

    const sessionId = url.searchParams.get("session_id");
    const token = localStorage.getItem("auth_token");

    url.searchParams.delete("payment");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", url.toString());

    if (!token) return;
    const auth = { Authorization: `Bearer ${token}` };

    const refreshUser = () =>
      fetch(`${API_BASE}/api/auth/me`, { headers: auth })
        .then((res) => (res.ok ? res.json() : null))
        .then((u) => {
          if (u) setUser(u);
          return u;
        })
        .catch(() => null);

    if (sessionId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUpgrading(true);
      fetch(`${API_BASE}/api/checkout/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ session_id: sessionId }),
      })
        .catch(() => null)
        .then(() => refreshUser())
        .finally(() => setUpgrading(false));
      return;
    }

    // No session id in the URL -- fall back to the old poll.
    let attempts = 0;
    const poll = () =>
      refreshUser().then((u) => {
        attempts += 1;
        if (u && !u.is_pro && attempts < 4) setTimeout(poll, 3000);
      });
    poll();
  }, []);

  return (
    <div className="min-h-screen bg-surface-0 text-ink flex flex-col font-sans">
      <Navbar
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenPricing={() => setIsPricingOpen(true)}
        onLogout={() => setUser(null)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:py-8">
        {/* Search Input */}
        <div className="max-w-3xl mx-auto mb-6 space-y-4">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-ink-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchMovies()}
              placeholder="Search by title, director, actor, or plot (e.g., დათა თუთაშხია, Inception)..."
              className="w-full bg-surface-1 border border-line rounded-2xl py-3.5 pl-11 sm:pl-12 pr-[4.5rem] sm:pr-28 text-ink placeholder:text-ink-muted focus:outline-none focus:border-blue-500 transition shadow-lg"
            />
            <button
              onClick={fetchMovies}
              disabled={loading}
              aria-label="Search"
              className="absolute right-2 px-3 sm:px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-surface-2 disabled:text-ink-muted text-white text-sm font-semibold rounded-xl transition flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Search</span>
                </>
              )}
            </button>
          </div>

          {/* Filter Bar */}
          <FilterBar filters={filters} setFilters={setFilters} />
        </div>

        {upgrading && (
          <div className="max-w-3xl mx-auto mb-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-sm text-blue-500 flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>Confirming your payment with Stripe…</span>
          </div>
        )}

        {quotaMessage && (
          <div className="max-w-3xl mx-auto mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-500 flex items-center justify-between gap-3">
            <span>{quotaMessage}</span>
            <button
              onClick={() => setIsPricingOpen(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-xs font-semibold"
            >
              Upgrade
            </button>
          </div>
        )}

        {quota && !quota.unlimited && (
          <p className="max-w-3xl mx-auto mb-4 text-xs text-ink-muted">
            {quota.limit - quota.used} of {quota.limit} free searches left today
          </p>
        )}

        {/* Results Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-ink-muted gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm">Searching movie archive...</p>
          </div>
        ) : results.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-ink-muted">
                Found{" "}
                <span className="text-ink font-semibold">{results.length}</span>{" "}
                movies matching your query:
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {results.map((movie) => (
                <MovieCard
                  key={movie.source_id || movie.id}
                  movie={movie}
                  onClick={() => setSelectedMovie(movie)}
                />
              ))}
            </div>
          </div>
        ) : query ? (
          <div className="text-center py-20 text-ink-muted">
            <Film className="w-12 h-12 stroke-1 mx-auto mb-3 text-ink-muted" />
            <p className="text-base font-medium text-ink-muted">
              No movies found
            </p>
            <p className="text-xs text-ink-muted mt-1">
              Try another search term or change your catalog/filter settings.
            </p>
          </div>
        ) : null}
      </main>

      {/* Modals */}
      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onSelectMovie={(nextMovie) => setSelectedMovie(nextMovie)}
          user={user}
          isInWatchlist={watchlistIds.includes(selectedMovie.id)}
          onToggleWatchlist={handleToggleWatchlist}
        />
      )}

      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        user={user}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(userData) => {
          setUser(userData.user || userData);
          setIsAuthOpen(false);
        }}
      />
    </div>
  );
}
