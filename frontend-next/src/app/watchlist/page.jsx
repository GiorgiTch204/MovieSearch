"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookmarkX, Loader2 } from "lucide-react";
import { MovieCard } from "@/components/MovieCard";
import { MovieModal } from "@/components/MovieModal";

export default function WatchlistPage() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState(null);

  const apiUrl = (
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  const loadWatchlist = async () => {
    setLoading(true);
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${apiUrl}/api/watchlist`, {
        credentials: "include",
        headers: headers,
      });
      if (res.ok) {
        const data = await res.json();
        setMovies(data || []);
      }
    } catch (err) {
      console.error("Failed to load watchlist:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWatchlist();
  }, []);

  const handleToggleWatchlist = async (movieId) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    try {
      const res = await fetch(`${apiUrl}/api/watchlist/${movieId}`, {
        method: "DELETE",
        headers: headers,
      });
      if (res.ok) {
        setMovies((prev) => prev.filter((m) => m.id !== movieId));
        setSelectedMovie(null);
      }
    } catch (err) {
      console.error("Failed to toggle watchlist:", err);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 text-ink flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-7xl flex items-center justify-between mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink bg-surface-1 border border-line px-3.5 py-2 rounded-xl transition hover:border-line"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </Link>
        <h1 className="text-xl font-bold text-ink">Your Saved Watchlist</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-indigo-400 mt-20 text-sm">
          <Loader2 className="w-6 h-6 animate-spin" /> Loading your movies...
        </div>
      ) : movies.length === 0 ? (
        <div className="text-center text-ink-muted mt-20 flex flex-col items-center">
          <BookmarkX className="w-16 h-16 mb-4 stroke-[1.2]" />
          <p className="text-ink-muted text-sm mb-3">
            No movies saved to your watchlist yet.
          </p>
          <Link
            href="/"
            className="text-xs text-indigo-400 underline hover:text-indigo-300"
          >
            Go discover some movies
          </Link>
        </div>
      ) : (
        <div className="w-full max-w-7xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {movies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
              onClick={() => setSelectedMovie(movie)}
            />
          ))}
        </div>
      )}

      <MovieModal
        movie={selectedMovie}
        user={true}
        isInWatchlist={true}
        onToggleWatchlist={handleToggleWatchlist}
        onClose={() => setSelectedMovie(null)}
        onSelectSimilar={() => {}}
      />
    </div>
  );
}
