// Single source of truth for the backend base URL.
//
// Every page/component used to inline its own
// `process.env.NEXT_PUBLIC_API_URL || "<fallback>"` and most copies used
// "http://127.0.0.1:8000" as the fallback, but app/page.jsx alone fell back
// to the deployed Render URL instead. That meant whenever
// NEXT_PUBLIC_API_URL was not set, the homepage search talked to production
// while every other page (login, register, watchlist, admin, settings,
// movie browsing, pricing) silently tried to reach localhost:8000 and
// failed. Importing API_BASE from here keeps the fallback identical
// everywhere and prevents it from drifting apart again.
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
