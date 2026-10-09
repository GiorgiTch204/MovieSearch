"use client";

import React from "react";
import { SlidersHorizontal } from "lucide-react";

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
}) {
  // Support both unified object state and individual props seamlessly
  const currentCatalog =
    catalog !== undefined ? catalog : filters.catalog || "";
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

  const handleUpdate = (key, value, setter) => {
    if (setter) setter(value);
    if (setFilters) {
      setFilters((prev) => ({ ...(prev || {}), [key]: value }));
    }
  };

  return (
    <div className="bg-surface-1/90 border border-line rounded-2xl p-4 backdrop-blur space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {/* Catalog Filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            კატალოგი / Catalog
          </label>
          <select
            value={currentCatalog}
            onChange={(e) =>
              handleUpdate("catalog", e.target.value || null, setCatalog)
            }
            className="bg-surface-0 border border-line text-ink text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">ყველა კატალოგი (All)</option>
            <option value="geocinema">ქართული კინოკლასიკა (Geocinema)</option>
            <option value="tmdb">საერთაშორისო (TMDb)</option>
          </select>
        </div>

        {/* Genre Filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            ჟანრი / Genre
          </label>
          <select
            value={currentGenre}
            onChange={(e) =>
              handleUpdate("genre", e.target.value || null, setSelectedGenre)
            }
            className="bg-surface-0 border border-line text-ink text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">ყველა ჟანრი (All)</option>
            <option value="კომედია">კომედია</option>
            <option value="დრამა">დრამა</option>
            <option value="სათავგადასავლო">სათავგადასავლო</option>
            <option value="Action">Action</option>
            <option value="Comedy">Comedy</option>
            <option value="Drama">Drama</option>
            <option value="Horror">Horror</option>
            <option value="Sci-Fi">Sci-Fi</option>
            <option value="Thriller">Thriller</option>
          </select>
        </div>

        {/* Era Filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            ეპოქა / Era
          </label>
          <select
            value={currentEra}
            onChange={(e) =>
              handleUpdate("era", e.target.value || null, setEra)
            }
            className="bg-surface-0 border border-line text-ink text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">ნებისმიერი პერიოდი (Any)</option>
            <option value="before_1990">1990 წლამდე (Before 1990)</option>
            <option value="1990s">1990-იანი წლები (1990s)</option>
            <option value="2000s">2000-იანი წლები (2000s)</option>
            <option value="2010_plus">2010 და შემდეგ (2010+)</option>
          </select>
        </div>

        {/* Min Rating Filter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            მინ. რეიტინგი / Min Rating
          </label>
          <select
            value={currentRating}
            onChange={(e) =>
              handleUpdate(
                "minRating",
                e.target.value ? Number(e.target.value) : null,
                setMinRating,
              )
            }
            className="bg-surface-0 border border-line text-ink text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="">ნებისმიერი (Any)</option>
            <option value="6">★ 6.0+</option>
            <option value="7">★ 7.0+</option>
            <option value="8">★ 8.0+</option>
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
