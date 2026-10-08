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

      // Queries the FastAPI backend
      const res = await fetch(
        `${API_BASE}/api/movies/search?${params.toString()}`,
      );
      if (!res.ok) {
        // Fallback check if route is mapped to /api/search
        const fallbackRes = await fetch(
          `${API_BASE}/api/search?${params.toString()}`,
        );
        if (!fallbackRes.ok) throw new Error("Search request failed");
        const data = await fallbackRes.json();
        setResults(data.results || []);
        return;
      }

      const data = await res.json();
      setResults(data.results || []);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenPricing={() => setIsPricingOpen(true)}
        onLogout={() => setUser(null)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        {/* Search Input */}
        <div className="max-w-3xl mx-auto mb-6 space-y-4">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchMovies()}
              placeholder="Search by title, director, actor, or plot (e.g., დათა თუთაშხია, Inception)..."
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-28 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition shadow-lg"
            />
            <button
              onClick={fetchMovies}
              disabled={loading}
              className="absolute right-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Search"
              )}
            </button>
          </div>

          {/* Filter Bar */}
          <FilterBar filters={filters} setFilters={setFilters} />
        </div>

        {/* Results Area */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm">Searching movie archive...</p>
          </div>
        ) : results.length > 0 ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-slate-400">
                Found{" "}
                <span className="text-white font-semibold">
                  {results.length}
                </span>{" "}
                movies matching your query:
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
          <div className="text-center py-20 text-slate-500">
            <Film className="w-12 h-12 stroke-1 mx-auto mb-3 text-slate-600" />
            <p className="text-base font-medium text-slate-400">
              No movies found
            </p>
            <p className="text-xs text-slate-500 mt-1">
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
