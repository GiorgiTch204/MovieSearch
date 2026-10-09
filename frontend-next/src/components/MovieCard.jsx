import React from "react";
import { Film, Star, Calendar } from "lucide-react";

export function MovieCard({ movie, onClick }) {
  const displayTitle = movie.title_ka || movie.title || "უსათაურო";

  const displayYear =
    movie.release_year ||
    (movie.release_date ? movie.release_date.substring(0, 4) : null);

  const rawPoster = movie.poster_url || movie.poster_path;
  const hasValidPoster =
    rawPoster &&
    !rawPoster.includes("nophoto") &&
    (rawPoster.startsWith("http") || rawPoster.startsWith("/"));

  const posterSrc = rawPoster?.startsWith("http")
    ? rawPoster
    : rawPoster
      ? `https://image.tmdb.org/t/p/w500${rawPoster}`
      : null;

  const displayOverview =
    movie.overview ||
    (movie.director ? `რეჟისორი: ${movie.director}` : null) ||
    "ქართული კინოარქივი";

  return (
    <div
      onClick={onClick}
      className="group relative bg-surface-1 border border-line rounded-xl overflow-hidden hover:border-slate-600 transition duration-200 cursor-pointer flex flex-col"
    >
      <div className="relative aspect-2/3 w-full bg-surface-0 flex items-center justify-center overflow-hidden">
        {hasValidPoster && posterSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterSrc}
            alt={displayTitle}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center text-ink-muted">
            <Film className="w-12 h-12 stroke-1 mb-2 text-ink-muted" />
            <span className="text-xs font-medium text-ink-muted">
              პოსტერი არ არის
            </span>
          </div>
        )}

        {movie.catalog_source === "geocinema" && (
          <span className="absolute top-2 left-2 bg-red-600/90 text-ink text-[10px] font-semibold px-2 py-0.5 rounded shadow">
            GEO
          </span>
        )}

        {movie.vote_average ? (
          <span className="absolute top-2 right-2 bg-surface-1/80 backdrop-blur text-yellow-400 text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 border border-line">
            <Star className="w-3 h-3 fill-yellow-400" />
            {Number(movie.vote_average).toFixed(1)}
          </span>
        ) : null}
      </div>

      <div className="p-3 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold text-ink text-sm line-clamp-1 group-hover:text-blue-400 transition">
            {displayTitle}
          </h3>

          <div className="flex items-center gap-2 text-xs text-ink-muted mt-1">
            {displayYear && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {displayYear}
              </span>
            )}
            {movie.genre && <span>• {movie.genre}</span>}
          </div>

          <p className="text-xs text-ink-muted mt-2 line-clamp-2 leading-relaxed">
            {displayOverview}
          </p>
        </div>

        {movie.director && (
          <p className="text-[11px] text-ink-muted mt-2 pt-2 border-t border-line/80 truncate">
            რჟ: <span className="text-ink">{movie.director}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// უზრუნველყოფს default export-საც, რათა ნებისმიერი სახის import-მა იმუშაოს
export default MovieCard;
