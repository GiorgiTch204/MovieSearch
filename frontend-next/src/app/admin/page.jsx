"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  Crown,
  Search,
  CreditCard,
  Bookmark,
  Film,
  TrendingUp,
  ShieldCheck,
  ArrowLeft,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";

const API = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const PAGE_SIZE = 20;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function authHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMoney(cents) {
  const n = Number(cents || 0) / 100;
  return `$${n.toFixed(2)}`;
}

function identityLabel(row) {
  if (row.username) return row.username;
  if (row.email) return row.email;
  const id = String(row.identity || "");
  if (id.startsWith("ip:")) return `Guest · ${id.slice(3)}`;
  if (id.startsWith("user:")) return `User #${id.slice(5)} (deleted)`;
  return id || "—";
}

/* ------------------------------------------------------------------ */
/* small presentational pieces                                         */
/* ------------------------------------------------------------------ */

const StatCard = ({ icon: Icon, label, value, sub, tint }) => (
  <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-5">
    <div
      className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${tint} opacity-20 blur-xl`}
    />
    <div className="relative flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          {label}
        </p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-ink">
          {value}
        </p>
        {sub ? <p className="mt-1 text-xs text-ink-muted">{sub}</p> : null}
      </div>
      <div
        className={`rounded-xl bg-gradient-to-br ${tint} p-2.5 text-white shadow-lg`}
      >
        <Icon className="h-4 w-4" />
      </div>
    </div>
  </div>
);

const Panel = ({ title, subtitle = null, right = null, children }) => (
  <section className="rounded-2xl border border-line bg-surface-1 overflow-hidden">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
        ) : null}
      </div>
      {right}
    </header>
    {children}
  </section>
);

const Pill = ({ tone = "muted", children }) => {
  const tones = {
    muted: "bg-surface-2 text-ink-muted border-line",
    pro: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent",
    admin:
      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    paid: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    fail: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
        tones[tone] || tones.muted
      }`}
    >
      {children}
    </span>
  );
};

const ActivityChart = ({ daily }) => {
  const max = Math.max(1, ...daily.map((d) => Math.max(d.searches, d.signups)));
  return (
    <div className="px-5 py-5">
      <div className="flex items-end gap-1.5 h-40">
        {daily.map((d) => (
          <div
            key={d.day}
            className="group flex-1 flex flex-col items-center gap-1"
          >
            <div className="relative flex w-full items-end justify-center gap-0.5 h-full">
              <div
                className="w-1/2 rounded-t bg-gradient-to-t from-blue-600 to-indigo-500 transition-all"
                style={{ height: `${(d.searches / max) * 100}%` }}
                title={`${d.searches} searches`}
              />
              <div
                className="w-1/2 rounded-t bg-gradient-to-t from-emerald-600 to-teal-500 transition-all"
                style={{ height: `${(d.signups / max) * 100}%` }}
                title={`${d.signups} signups`}
              />
              <div className="pointer-events-none absolute -top-9 hidden whitespace-nowrap rounded-lg border border-line bg-surface-0 px-2 py-1 text-[10px] font-medium text-ink shadow-lg group-hover:block">
                {d.searches} searches · {d.signups} signups
              </div>
            </div>
            <span className="text-[9px] text-ink-muted">{d.day.slice(8)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 text-[11px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded bg-gradient-to-t from-blue-600 to-indigo-500" />
          Searches
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded bg-gradient-to-t from-emerald-600 to-teal-500" />
          Sign-ups
        </span>
      </div>
    </div>
  );
};

const Pager = ({ offset, limit, total, onChange }) => {
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-3">
      <p className="text-xs text-ink-muted">
        {total === 0
          ? "No rows"
          : `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, offset - limit))}
          disabled={page <= 1}
          className="rounded-lg border border-line bg-surface-2 p-1.5 text-ink-muted transition hover:text-ink disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-ink-muted">
          {page} / {pages}
        </span>
        <button
          onClick={() => onChange(offset + limit)}
          disabled={page >= pages}
          className="rounded-lg border border-line bg-surface-2 p-1.5 text-ink-muted transition hover:text-ink disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* page                                                                */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const [me, setMe] = useState(null);
  const [gate, setGate] = useState("loading"); // loading | ok | denied | anon
  const [tab, setTab] = useState("users");

  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState({ users: [], total: 0 });
  const [payments, setPayments] = useState({ payments: [], total: 0 });
  const [searches, setSearches] = useState({ recent: [], top: [] });

  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("all");
  const [userOffset, setUserOffset] = useState(0);
  const [payOffset, setPayOffset] = useState(0);

  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  /* --- who am I ------------------------------------------------- */
  useEffect(() => {
    apiGet("/api/auth/me")
      .then((u) => {
        setMe(u);
        setGate(u?.is_admin ? "ok" : "denied");
      })
      .catch(() => setGate("anon"));
  }, []);

  /* --- data ----------------------------------------------------- */
  const loadOverview = useCallback(async () => {
    const data = await apiGet("/api/admin/overview");
    setOverview(data);
  }, []);

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(userOffset),
    });
    if (query.trim()) params.set("q", query.trim());
    if (plan !== "all") params.set("plan", plan);
    setUsers(await apiGet(`/api/admin/users?${params.toString()}`));
  }, [query, plan, userOffset]);

  const loadPayments = useCallback(async () => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(payOffset),
    });
    setPayments(await apiGet(`/api/admin/payments?${params.toString()}`));
  }, [payOffset]);

  const loadSearches = useCallback(async () => {
    setSearches(await apiGet("/api/admin/searches?limit=60"));
  }, []);

  useEffect(() => {
    if (gate !== "ok") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOverview().catch((e) => setError(e.message));
  }, [gate, loadOverview]);

  useEffect(() => {
    if (gate !== "ok" || tab !== "users") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUsers().catch((e) => setError(e.message));
  }, [gate, tab, loadUsers]);

  useEffect(() => {
    if (gate !== "ok" || tab !== "payments") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPayments().catch((e) => setError(e.message));
  }, [gate, tab, loadPayments]);

  useEffect(() => {
    if (gate !== "ok" || tab !== "searches") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSearches().catch((e) => setError(e.message));
  }, [gate, tab, loadSearches]);

  // Debounce the user search box
  useEffect(() => {
    if (gate !== "ok" || tab !== "users") return;
    const t = setTimeout(() => setUserOffset(0), 350);
    return () => clearTimeout(t);
  }, [query, plan, gate, tab]);

  const refreshAll = async () => {
    setRefreshing(true);
    setError("");
    try {
      await loadOverview();
      if (tab === "users") await loadUsers();
      if (tab === "payments") await loadPayments();
      if (tab === "searches") await loadSearches();
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const togglePro = async (user) => {
    setBusyId(user.id);
    setError("");
    try {
      const res = await fetch(`${API}/api/admin/users/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ is_pro: !user.is_pro }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Could not update that user");
      }
      await loadUsers();
      await loadOverview();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const stats = overview?.stats;
  const daily = overview?.daily || [];

  const tiles = useMemo(() => {
    if (!stats) return [];
    return [
      {
        icon: Users,
        label: "Registered users",
        value: stats.total_users,
        sub: `${stats.new_users_7d} new this week`,
        tint: "from-blue-600 to-indigo-600",
      },
      {
        icon: Crown,
        label: "Pro members",
        value: stats.pro_users,
        sub:
          stats.total_users > 0
            ? `${Math.round((stats.pro_users / stats.total_users) * 100)}% conversion`
            : "—",
        tint: "from-amber-500 to-orange-600",
      },
      {
        icon: CreditCard,
        label: "Revenue",
        value: fmtMoney(stats.revenue_cents),
        sub: `${stats.paid_count} paid checkout${stats.paid_count === 1 ? "" : "s"}`,
        tint: "from-emerald-600 to-teal-600",
      },
      {
        icon: Search,
        label: "Searches",
        value: stats.total_searches,
        sub: `${stats.searches_24h} in the last 24h`,
        tint: "from-violet-600 to-fuchsia-600",
      },
      {
        icon: Bookmark,
        label: "Watchlist saves",
        value: stats.watchlist_items,
        sub: "across all accounts",
        tint: "from-sky-600 to-cyan-600",
      },
      {
        icon: Film,
        label: "Catalog",
        value: stats.total_movies,
        sub: `${stats.georgian_movies} Georgian titles`,
        tint: "from-rose-600 to-pink-600",
      },
    ];
  }, [stats]);

  /* --- gates ---------------------------------------------------- */
  if (gate === "loading") {
    return (
      <main className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="flex items-center gap-3 text-ink-muted">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Checking permissions…</span>
        </div>
      </main>
    );
  }

  if (gate !== "ok") {
    return (
      <main className="min-h-screen bg-surface-0 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-line bg-surface-1 p-8 text-center">
          <div className="mx-auto mb-4 w-fit rounded-2xl bg-rose-500/10 p-3 text-rose-500">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-ink">
            {gate === "anon" ? "Sign in required" : "Admins only"}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {gate === "anon"
              ? "This page is only reachable with an administrator account."
              : `${me?.username || me?.email || "This account"} does not have administrator access.`}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            <ArrowLeft className="h-4 w-4" /> Back to MovieSearch
          </Link>
        </div>
      </main>
    );
  }

  /* --- dashboard ------------------------------------------------ */
  return (
    <main className="min-h-screen bg-surface-0">
      {/* Header */}
      <div className="border-b border-line bg-gradient-to-br from-blue-600/10 via-indigo-600/5 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to MovieSearch
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 p-3 text-white shadow-lg shadow-blue-500/25">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-ink">
                  Admin dashboard
                </h1>
                <p className="mt-0.5 text-sm text-ink-muted">
                  Signed in as {me?.username || me?.email}
                </p>
              </div>
            </div>
            <button
              onClick={refreshAll}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface-1 px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-surface-2 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        {/* Stat tiles */}
        {stats ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((t) => (
              <StatCard key={t.label} {...t} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-2xl border border-line bg-surface-1"
              />
            ))}
          </div>
        )}

        {/* Activity */}
        <Panel
          title="Last 14 days"
          subtitle="Searches run and accounts created, per day"
          right={
            <span className="flex items-center gap-1.5 text-xs text-ink-muted">
              <TrendingUp className="h-3.5 w-3.5" />
              {stats ? `${stats.new_users_24h} signed up today` : ""}
            </span>
          }
        >
          {daily.length ? (
            <ActivityChart daily={daily} />
          ) : (
            <div className="px-5 py-10 text-center text-sm text-ink-muted">
              No activity recorded yet.
            </div>
          )}
        </Panel>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: "users", label: "Users", icon: Users },
            { id: "payments", label: "Payments", icon: CreditCard },
            { id: "searches", label: "Search activity", icon: Search },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
                tab === t.id
                  ? "border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                  : "border-line bg-surface-1 text-ink-muted hover:text-ink"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {/* Users */}
        {tab === "users" ? (
          <Panel
            title="Registered users"
            subtitle="Everyone who has created an account"
            right={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or email…"
                  className="w-48 rounded-xl border border-line bg-surface-0 px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-blue-500 focus:outline-none"
                />
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="rounded-xl border border-line bg-surface-0 px-3 py-1.5 text-xs text-ink focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">All plans</option>
                  <option value="pro">Pro only</option>
                  <option value="free">Free only</option>
                </select>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-5 py-3 font-semibold">User</th>
                    <th className="px-3 py-3 font-semibold">Joined</th>
                    <th className="px-3 py-3 font-semibold">Plan</th>
                    <th className="px-3 py-3 font-semibold text-right">
                      Searches
                    </th>
                    <th className="px-3 py-3 font-semibold text-right">
                      Watchlist
                    </th>
                    <th className="px-3 py-3 font-semibold">Last search</th>
                    <th className="px-3 py-3 font-semibold text-right">Paid</th>
                    <th className="px-5 py-3 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-t border-line transition hover:bg-surface-2/60"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar user={u} size={34} ring={u.is_pro} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">
                              {u.username || "—"}
                              {u.is_admin ? (
                                <span className="ml-2 align-middle">
                                  <Pill tone="admin">admin</Pill>
                                </span>
                              ) : null}
                            </p>
                            <p className="truncate text-xs text-ink-muted">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-muted">
                        {fmtDate(u.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        {u.is_pro ? (
                          <Pill tone="pro">
                            <Crown className="h-3 w-3" /> Pro
                          </Pill>
                        ) : (
                          <Pill>Free</Pill>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-ink">
                        {u.search_count}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-ink">
                        {u.watchlist_count}
                      </td>
                      <td className="px-3 py-3 text-xs text-ink-muted">
                        {fmtDateTime(u.last_search)}
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-ink-muted">
                        {Number(u.paid_cents) > 0
                          ? fmtMoney(u.paid_cents)
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => togglePro(u)}
                          disabled={busyId === u.id}
                          className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-muted transition hover:text-ink disabled:opacity-50"
                        >
                          {busyId === u.id
                            ? "Saving…"
                            : u.is_pro
                              ? "Revoke Pro"
                              : "Grant Pro"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.users.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-10 text-center text-sm text-ink-muted"
                      >
                        No users match that filter.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <Pager
              offset={userOffset}
              limit={PAGE_SIZE}
              total={users.total}
              onChange={setUserOffset}
            />
          </Panel>
        ) : null}

        {/* Payments */}
        {tab === "payments" ? (
          <Panel
            title="Payments"
            subtitle="Every Stripe checkout recorded by the webhook"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-5 py-3 font-semibold">When</th>
                    <th className="px-3 py-3 font-semibold">Customer</th>
                    <th className="px-3 py-3 font-semibold text-right">
                      Amount
                    </th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Stripe session</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.payments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-line transition hover:bg-surface-2/60"
                    >
                      <td className="px-5 py-3 text-xs text-ink-muted">
                        {fmtDateTime(p.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-ink">
                          {p.username || "—"}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {p.email || `user #${p.user_id ?? "?"}`}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-ink">
                        {fmtMoney(p.amount)}{" "}
                        <span className="text-[10px] font-normal uppercase text-ink-muted">
                          {p.currency}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Pill tone={p.status === "paid" ? "paid" : "fail"}>
                          {p.status || "unknown"}
                        </Pill>
                      </td>
                      <td className="px-5 py-3">
                        <code className="text-[10px] text-ink-muted">
                          {(p.stripe_session_id || "—").slice(0, 28)}
                        </code>
                      </td>
                    </tr>
                  ))}
                  {payments.payments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-10 text-center text-sm text-ink-muted"
                      >
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <Pager
              offset={payOffset}
              limit={PAGE_SIZE}
              total={payments.total}
              onChange={setPayOffset}
            />
          </Panel>
        ) : null}

        {/* Searches */}
        {tab === "searches" ? (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Panel
                title="Recent searches"
                subtitle="Newest first, with the account that ran them"
              >
                <ul className="divide-y divide-[color:var(--line)]">
                  {searches.recent.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-4 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">
                          {s.query ? (
                            `“${s.query}”`
                          ) : (
                            <span className="text-ink-muted italic">
                              (logged before query text was recorded)
                            </span>
                          )}
                        </p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                          <span>{identityLabel(s)}</span>
                          {s.catalog ? (
                            <span className="flex items-center gap-1">
                              <Globe className="h-3 w-3" /> {s.catalog}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-muted">
                        <Clock className="h-3 w-3" />{" "}
                        {fmtDateTime(s.created_at)}
                      </span>
                    </li>
                  ))}
                  {searches.recent.length === 0 ? (
                    <li className="px-5 py-10 text-center text-sm text-ink-muted">
                      No searches recorded yet.
                    </li>
                  ) : null}
                </ul>
              </Panel>
            </div>

            <div className="lg:col-span-2">
              <Panel title="Most searched" subtitle="Top queries all time">
                <ol className="divide-y divide-[color:var(--line)]">
                  {searches.top.map((t, i) => (
                    <li
                      key={t.query}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="w-5 shrink-0 text-xs font-bold text-ink-muted">
                          {i + 1}
                        </span>
                        <span className="truncate text-sm font-medium text-ink">
                          {t.query}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                        {t.n}×
                      </span>
                    </li>
                  ))}
                  {searches.top.length === 0 ? (
                    <li className="px-5 py-10 text-center text-sm text-ink-muted">
                      Nothing to rank yet.
                    </li>
                  ) : null}
                </ol>
              </Panel>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
