"use client";

import { Server, Sparkles } from "lucide-react";

/**
 * Shown instead of a bare spinner once a request has been in flight for a
 * while. The API (Render free tier) and the database (Neon free tier) both
 * nap when idle, so the first request after a day can take up to ~30s to
 * come back. A plain spinner reads as "broken" at that point; this explains
 * what's actually happening so people don't bail or refresh mid-login.
 *
 * Fully responsive: the copy, icon and padding all scale down for narrow
 * phone screens, and the whole thing fits inside a small modal without
 * overflowing it.
 */
export function ColdStartNotice({ label = "Waking up the server…", className = "" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative overflow-hidden rounded-xl sm:rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/10 via-surface-1 to-surface-1 p-3.5 sm:p-5 ${className}`}
    >
      {/* Ambient glow blobs -- purely decorative, clipped by overflow-hidden */}
      <div className="pointer-events-none absolute -top-10 -right-10 w-24 h-24 sm:w-32 sm:h-32 bg-indigo-500/20 rounded-full blur-2xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 w-20 h-20 sm:w-28 sm:h-28 bg-blue-500/10 rounded-full blur-2xl animate-pulse [animation-delay:600ms]" />

      <div className="relative flex items-start gap-2.5 sm:gap-3.5">
        {/* Icon with an expanding "wake" ring */}
        <div className="relative shrink-0 mt-0.5">
          <span className="absolute inset-0 rounded-lg border border-indigo-400/60 [animation:coldstart-ring_1.8s_ease-out_infinite]" />
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
            <Server className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
          </div>
          <Sparkles className="w-3 h-3 text-amber-300 absolute -top-1 -right-1 animate-ping" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-ink leading-snug">
            {label}
          </p>
          <p className="text-[11px] sm:text-xs text-ink-muted mt-1 leading-relaxed">
            The free-tier server naps when nobody&apos;s around. First visit
            after a while can take up to ~30s to spin back up &mdash; no need
            to refresh, it&apos;s already on its way.
          </p>

          {/* Indeterminate sweep bar -- there's no real progress to report,
              so this reads as "working", not "almost done". */}
          <div className="mt-2.5 sm:mt-3 h-1.5 w-full rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full w-1/3 min-w-[2.5rem] rounded-full bg-gradient-to-r from-indigo-500 via-blue-400 to-indigo-500 [animation:coldstart-sweep_1.4s_ease-in-out_infinite]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ColdStartNotice;
