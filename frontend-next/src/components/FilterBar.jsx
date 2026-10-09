"use client";

import React, { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const TYPES = [
  { value: "", label: "ყველა / All types" },
  { value: "movie", label: "ფილმები / Movies" },
  { value: "tv", label: "სერიალები / TV series" },
];

const CATALOGS = [
  { value: "", label: "ყველა კატალოგი (All)" },
  { value: "geocinema", label: "ქართული კინოკლასიკა (Geocinema)" },
  { value: "tmdb", label: "საერთაშორისო (TMDb)" },
];

const ERAS = [
  { value: "", label: "ნებისმიერი პერიოდი (Any)" },
  { value: "before_1950", label: "1950 წლამდე (Before 1950)" },
  { value: "1950s", label: "1950-იანი (1950s)" },
  { value: "1960s", label: "1960-იანი (1960s)" },
  { value: "1970s", label: "1970-იანი (1970s)" },
  { value: "1980s", label: "1980-იანი (1980s)" },
  { value: "1990s", label: "1990-იანი (1990s)" },
  { value: "2000s", label: "2000-იანი (2000s)" },
  { value: "2010s", label: "2010-იანი (2010s)" },
  { value: "2020s", label: "2020-იანი (2020s)" },
];

const RATINGS = [
  { value: "", label: "ნებისმიერი (Any)" },
  { value: "6", label: "★ 6.0+" },
  { value: "7", label: "★ 7.0+" },
  { value: "8", label: "★ 8.0+" },
];

const field =
  "bg-surface-0 border border-line text-ink text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer";
const label =
  "text-[11px] font-semibold tracking-wider text-ink-muted uppercase";

export function FilterBar({
  filters = {},
  setFilters = () => {},
  selectedGenre,
  setSelectedGenre,
  era,
  setEra,
  minRating,
  setMinRating,
  semanticWeight,
  setSemanticWeight,
  catalog,
  setCatalog,
  mediaType,
  setMediaType,
}) {
  // Support both unified object state and individual props seamlessly
  const currentCatalog =
    catalog !== undefined ? catalog : filters.catalog || "";
  const currentType =
    mediaType !== undefined ? mediaType : filters.mediaType || "";
  const currentGenre =
    selectedGenre !== undefined ? selectedGenre : filters.genre || "";
  const currentEra = era !== undefined ? era : filters.era || "";
  const currentRating =
    minRating !== undefined ? minRating : filters.minRating || "";
  const currentWeight =
    typeof semanticWeight === "number"
      ? semanticWeight
      : typeof filters.semanticWeight === "number"
        ? filters.semanticWeight
        : 0.5;

  // Genres come from the database rather than a hardcoded list. A fixed list
  // drifts out of step with the data -- the previous one offered "Sci-Fi",
  // which never matched anything, because TMDb writes "Science Fiction".
  const [genres, setGenres] = useState([]);
  useEffect(() => {
    fetch(`${API_BASE}/api/genres`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setGenres(d.genres || []))
      .catch(() => {});
  }, []);

  const handleUpdate = (key, value, setter) => {
    if (setter) setter(value);
    if (setFilters) {
      setFilters((prev) => ({ ...(prev || {}), [key]: value }));
    }
  };

  return (
    <div className="bg-surface-1/90 border border-line rounded-2xl p-4 backdrop-blur space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Type */}
        <div className="flex flex-col gap-1.5">
          <label className={label}>ტიპი / Type</label>
          <select
            value={currentType}
            onChange={(e) =>
              handleUpdate("mediaType", e.target.value || null, setMediaType)
            }
            className={field}
          >
            {TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Catalog */}
        <div className="flex flex-col gap-1.5">
          <label className={label}>კატალოგი / Catalog</label>
          <select
            value={currentCatalog}
            onChange={(e) =>
              handleUpdate("catalog", e.target.value || null, setCatalog)
            }
            className={field}
          >
            {CATALOGS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Genre */}
        <div className="flex flex-col gap-1.5">
          <label className={label}>ჟანრი / Genre</label>
          <select
            value={currentGenre}
            onChange={(e) =>
              handleUpdate("genre", e.target.value || null, setSelectedGenre)
            }
            className={field}
          >
            <option value="">ყველა ჟანრი (All)</option>
            {genres.map((g) => (
              <option key={g.genre} value={g.genre}>
                {g.genre} ({g.n})
              </option>
            ))}
          </select>
        </div>

        {/* Era */}
        <div className="flex flex-col gap-1.5">
          <label className={label}>ეპოქა / Era</label>
          <select
            value={currentEra}
            onChange={(e) =>
              handleUpdate("era", e.target.value || null, setEra)
            }
            className={field}
          >
            {ERAS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Min rating */}
        <div className="flex flex-col gap-1.5">
          <label className={label}>მინ. რეიტინგი / Min Rating</label>
          <select
            value={currentRating}
            onChange={(e) =>
              handleUpdate(
                "minRating",
                e.target.value ? Number(e.target.value) : null,
                setMinRating,
              )
            }
            className={field}
          >
            {RATINGS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Engine Weight Slider */}
      <div className="pt-3 border-t border-line/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-ink-muted font-medium">
          <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
          <span>Search Engine Weight:</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-80">
          <span
            className={`text-[11px] font-medium transition ${currentWeight <= 0.4 ? "text-blue-400 font-semibold" : "text-ink-muted"}`}
          >
            Keyword
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={currentWeight}
            onChange={(e) =>
              handleUpdate(
                "semanticWeight",
                parseFloat(e.target.value),
                setSemanticWeight,
              )
            }
            className="flex-1 h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <span
            className={`text-[11px] font-medium transition ${currentWeight >= 0.6 ? "text-blue-400 font-semibold" : "text-ink-muted"}`}
          >
            Semantic
          </span>
        </div>
      </div>
    </div>
  );
}

export default FilterBar;
