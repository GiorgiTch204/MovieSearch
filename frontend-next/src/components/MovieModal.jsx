"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  X,
  Star,
  Calendar,
  Brain,
  Loader2,
  Bookmark,
  Film,
} from "lucide-react";

export function MovieModal({
  movie,
  onClose,
  onSelectMovie,
  user,
  isInWatchlist = false,
  onToggleWatchlist = () => {},
}) {
  const [details, setDetails] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);

  const isGeorgian = movie?.catalog_source === "geocinema";

  useEffect(() => {
    if (!movie?.id) return;

    let isMounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    const loadData = async () => {
      try {
        const [resDetails, resSimilar] = await Promise.all([
          fetch(`http://localhost:8000/api/movies/${movie.id}`),
          fetch(`http://localhost:8000/api/movies/${movie.id}/similar`),
        ]);

        if (resDetails.ok && isMounted) {
          const dData = await resDetails.json();
          setDetails(dData);
        }

        if (resSimilar.ok && isMounted) {
          const sData = await resSimilar.json();
          setSimilar(Array.isArray(sData) ? sData : sData.results || []);
        } else if (isMounted) {
          setSimilar([]);
        }
      } catch (err) {
        console.error("Modal fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [movie]);

  if (!movie) return null;

  const title = movie.title_ka || movie.title || "Untitled";
  const year = movie.release_year || movie.release_date || "N/A";
  const rating = movie.vote_average
    ? Number(movie.vote_average).toFixed(1)
    : null;
  const posterSrc = movie.poster_url || movie.poster_path;
  const genres = details?.genres || (movie.genre ? movie.genre.split(",") : []);

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-400 hover:text-white z-30 bg-slate-950/70 p-2 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ========================================================
            TMDb DESIGN: Full-Width Video Player at the Top
           ======================================================== */}
        {!isGeorgian && (
          <div className="w-full aspect-video bg-black relative flex items-center justify-center border-b border-slate-800/80">
            {loading ? (
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            ) : details?.trailer ? (
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${details.trailer}?autoplay=1&mute=1&playsinline=1`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : details?.backdrop_path ? (
              <div className="relative w-full h-full">
                <Image
                  src={
                    details.backdrop_path.startsWith("http")
                      ? details.backdrop_path
                      : `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`
                  }
                  alt={title}
                  fill
                  className="object-cover opacity-75"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-4 text-xs font-semibold text-slate-400 bg-slate-950/70 px-2 py-1 rounded">
                  Trailer Unavailable • TMDb Collection
                </span>
              </div>
            ) : (
              <span className="text-slate-500 text-xs">
                Trailer Unavailable
              </span>
            )}
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Main Info Block */}
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Poster Card (Always visible with Georgian fallback design) */}
            <div className="w-28 sm:w-36 aspect-[2/3] shrink-0 bg-slate-800 rounded-xl overflow-hidden shadow-lg border border-slate-700/60 relative">
              {posterSrc && !posterSrc.toLowerCase().includes("nophoto") ? (
                <Image
                  src={posterSrc}
                  alt={title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                /* High-End Fallback for Missing Georgian/Archive Posters */
                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50">
                  <Film className="w-8 h-8 text-blue-400/60 mb-2 stroke-[1.5]" />
                  <span className="text-[11px] font-semibold text-slate-300 line-clamp-3">
                    {title}
                  </span>
                  <span className="text-[9px] text-blue-400/80 mt-1 uppercase tracking-wider">
                    {isGeorgian ? "ქართული არქივი" : "Archive"}
                  </span>
                </div>
              )}
            </div>

            {/* Title, Badges, and Details */}
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-white leading-tight">
                    {title}
                  </h2>
                  {movie.director && (
                    <p className="text-xs text-blue-400 font-medium mt-1">
                      {isGeorgian ? "რეჟისორი:" : "Director:"} {movie.director}
                    </p>
                  )}
                  {movie.studio && (
                    <p className="text-xs text-slate-400">
                      სტუდია: {movie.studio}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {user && (
                    <button
                      onClick={() => onToggleWatchlist(movie.id)}
                      className={`p-2 rounded-lg border text-xs font-semibold flex items-center transition ${
                        isInWatchlist
                          ? "bg-blue-600/20 border-blue-500 text-blue-400"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                      }`}
                    >
                      <Bookmark
                        className={`w-4 h-4 ${isInWatchlist ? "fill-blue-400" : ""}`}
                      />
                    </button>
                  )}

                  {rating && (
                    <div className="bg-amber-400/10 border border-amber-400/20 text-amber-400 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{rating}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Meta tags */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> {year}
                </span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-[11px] font-medium text-slate-300">
                  {isGeorgian ? "Geocinema" : "TMDb International"}
                </span>
                {genres.length > 0 && (
                  <>
                    <span>•</span>
                    <span className="line-clamp-1">{genres.join(", ")}</span>
                  </>
                )}
              </div>

              {/* Plot */}
              <div>
                <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  {isGeorgian ? "ფილმის შესახებ" : "Overview"}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed max-h-32 overflow-y-auto">
                  {movie.overview || "აღწერა ხელმისაწვდომი არ არის."}
                </p>
              </div>
            </div>
          </div>

          {/* Cast Chips */}
          {details?.cast && details.cast.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
                {isGeorgian ? "მსახიობები" : "Cast"}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {details.cast.map((actor, idx) => (
                  <span
                    key={idx}
                    className="bg-slate-800/80 text-slate-300 text-xs px-2.5 py-1 rounded-md border border-slate-700/50"
                  >
                    {actor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Similar Recommendations */}
          <div className="border-t border-slate-800 pt-4">
            <h4 className="text-xs uppercase tracking-wider text-blue-400 font-bold mb-3 flex items-center gap-1.5">
              <Brain className="w-4 h-4" />
              {isGeorgian ? "მსგავსი ფილმები" : "AI Similar Recommendations"}
            </h4>
            {Array.isArray(similar) && similar.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {similar.map((s, idx) => {
                  const sPoster = s.poster_url || s.poster_path;
                  return (
                    <div
                      key={s.source_id || s.id || idx}
                      className="cursor-pointer group"
                      onClick={() => onSelectMovie && onSelectMovie(s)}
                    >
                      <div className="relative aspect-[2/3] bg-slate-800 rounded-lg overflow-hidden border border-slate-800 group-hover:border-blue-500 transition">
                        {sPoster &&
                        !sPoster.toLowerCase().includes("nophoto") ? (
                          <Image
                            src={sPoster}
                            alt={s.title_ka || s.title || "Movie"}
                            fill
                            className="object-cover group-hover:scale-105 transition"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-1 text-center bg-slate-800">
                            <Film className="w-4 h-4 text-slate-500 mb-1" />
                            <span className="text-[9px] text-slate-400 line-clamp-2">
                              {s.title_ka || s.title}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-300 mt-1 line-clamp-1 group-hover:text-blue-400 transition">
                        {s.title_ka || s.title}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No recommendations available.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MovieModal;
