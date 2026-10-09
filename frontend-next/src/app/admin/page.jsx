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
  Trash2,
  KeyRound,
  X,
  AlertTriangle,
  ScrollText,
  UserCog,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";

const API = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const PAGE_SIZE = 20;

const ACTION_LABEL = {
  grant_admin: "made an admin:",
  revoke_admin: "removed admin from:",
  grant_pro: "granted Pro to:",
  revoke_pro: "revoked Pro from:",
  delete_user: "deleted the account:",
  reset_password: "set a new password for:",
};

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

async function apiSend(path, method, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed (${res.status})`);
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

const StatCard = ({ icon: Icon, label, value, sub = null, tint }) => (
  <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-1 p-4 sm:p-5">
    <div
      className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${tint} opacity-20 blur-xl`}
    />
    <div className="relative flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          {label}
        </p>
        <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-ink">
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
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5 sm:py-4">
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
  // 14 bars are unreadable on a phone -- hide all but the last 7 below sm
  const hideBefore = Math.max(0, daily.length - 7);
  return (
    <div className="px-4 py-5 sm:px-5">
      <div className="flex h-36 items-stretch gap-1 sm:h-44 sm:gap-1.5">
        {daily.map((d, i) => (
          <div
            key={d.day}
            className={`group h-full flex-1 flex-col items-center gap-1 ${
              i < hideBefore ? "hidden sm:flex" : "flex"
            }`}
          >
            {/* min-h-0 lets this flex child actually give up height, so the
                percentage heights on the bars below have something to resolve
                against */}
            <div className="relative flex w-full min-h-0 flex-1 items-end justify-center gap-0.5">
              <div
                className="w-1/2 rounded-t bg-gradient-to-t from-blue-600 to-indigo-500 transition-all"
                style={{ height: `${Math.max(2, (d.searches / max) * 100)}%` }}
                title={`${d.searches} searches`}
              />
              <div
                className="w-1/2 rounded-t bg-gradient-to-t from-emerald-600 to-teal-500 transition-all"
                style={{ height: `${Math.max(2, (d.signups / max) * 100)}%` }}
                title={`${d.signups} signups`}
              />
              <div className="pointer-events-none absolute -top-9 z-10 hidden whitespace-nowrap rounded-lg border border-line bg-surface-0 px-2 py-1 text-[10px] font-medium text-ink shadow-lg group-hover:block">
                {d.searches} searches · {d.signups} signups
              </div>
            </div>
            <span className="shrink-0 text-[9px] text-ink-muted sm:text-[10px]">
              {d.day.slice(8)}
            </span>
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
    <div className="flex items-center justify-between border-t border-line px-4 py-3 sm:px-5">
      <p className="text-xs text-ink-muted">
        {total === 0
          ? "No rows"
          : `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, offset - limit))}
          disabled={page <= 1}
          className="rounded-lg border border-line bg-surface-2 p-2.5 text-ink-muted transition hover:text-ink disabled:opacity-40 sm:p-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-medium text-ink-muted">
          {page} / {pages}
        </span>
        <button
          onClick={() => onChange(offset + limit)}
          disabled={page >= pages}
          className="rounded-lg border border-line bg-surface-2 p-2.5 text-ink-muted transition hover:text-ink disabled:opacity-40 sm:p-1.5"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 border-b border-line py-2 last:border-0">
    <span className="shrink-0 text-xs font-medium text-ink-muted">{label}</span>
    <span className="min-w-0 break-all text-right text-xs text-ink">
      {children}
    </span>
  </div>
);

const UserDrawer = ({ userId, meId, onClose, onChanged }) => {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [pw, setPw] = useState("");
  const [pwDone, setPwDone] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rolePw, setRolePw] = useState("");
  const [roleMsg, setRoleMsg] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    setErr("");
    setPw("");
    setPwDone("");
    setConfirmDelete(false);
    setRolePw("");
    setRoleMsg("");
    apiGet(`/api/admin/users/${userId}`)
      .then(setData)
      .catch((e) => setErr(e.message));
  }, [userId]);

  const u = data?.user;
  const isSelf = u && meId === u.id;

  const doDelete = async () => {
    setBusy("delete");
    setErr("");
    try {
      await apiSend(`/api/admin/users/${userId}`, "DELETE");
      onChanged();
      onClose();
    } catch (e) {
      setErr(e.message);
      setConfirmDelete(false);
    } finally {
      setBusy("");
    }
  };

  const doRole = async (grant) => {
    setBusy("role");
    setErr("");
    setRoleMsg("");
    try {
      const row = await apiSend(`/api/admin/users/${userId}/admin`, "POST", {
        grant,
        password: rolePw,
      });
      setRolePw("");
      setRoleMsg(
        grant
          ? `${row.username || row.email} is now an admin.`
          : `${row.username || row.email} is no longer an admin.`,
      );
      setData((d) => (d ? { ...d, user: { ...d.user, is_admin: grant } } : d));
      onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };

  const doReset = async () => {
    setBusy("pw");
    setErr("");
    setPwDone("");
    try {
      await apiSend(`/api/admin/users/${userId}/reset-password`, "POST", {
        new_password: pw,
      });
      setPwDone(pw);
      setPw("");
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full flex-col overflow-y-auto border-line bg-surface-0 shadow-2xl sm:max-w-md sm:border-l">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface-0/95 px-4 py-4 backdrop-blur sm:px-5">
          <h2 className="text-sm font-bold text-ink">Account details</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-6 px-4 py-5 sm:px-5">
          {err ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
              {err}
            </div>
          ) : null}

          {!data && !err ? (
            <p className="text-sm text-ink-muted">Loading…</p>
          ) : null}

          {u ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar user={u} size={48} ring={u.is_pro} />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-ink">
                    {u.username || "(no username)"}
                  </p>
                  <p className="truncate text-xs text-ink-muted">{u.email}</p>
                </div>
              </div>

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Stored fields
                </h3>
                <div className="rounded-xl border border-line bg-surface-1 px-4 py-2">
                  <Row label="ID">#{u.id}</Row>
                  <Row label="Username">{u.username || "—"}</Row>
                  <Row label="Email">{u.email}</Row>
                  <Row label="Registered">{fmtDateTime(u.created_at)}</Row>
                  <Row label="Plan">{u.is_pro ? "Pro" : "Free"}</Row>
                  <Row label="Admin">{u.is_admin ? "yes" : "no"}</Row>
                  <Row label="Password">
                    {u.has_password
                      ? "set (bcrypt hash, not readable)"
                      : "none"}
                  </Row>
                  <Row label="Avatar">
                    {u.has_avatar
                      ? `${u.avatar_mime || "image"}, ${Math.round(
                          (u.avatar_bytes || 0) / 1024,
                        )} KB`
                      : "none"}
                  </Row>
                  <Row label="Stripe customer">
                    {u.stripe_customer_id || "—"}
                  </Row>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Watchlist ({data.watchlist.length})
                </h3>
                <div className="rounded-xl border border-line bg-surface-1 px-4 py-2">
                  {data.watchlist.length ? (
                    data.watchlist.map((m) => (
                      <Row key={m.id} label={m.title}>
                        {m.release_year || "—"}
                      </Row>
                    ))
                  ) : (
                    <p className="py-2 text-xs text-ink-muted">Empty.</p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Payments ({data.payments.length})
                </h3>
                <div className="rounded-xl border border-line bg-surface-1 px-4 py-2">
                  {data.payments.length ? (
                    data.payments.map((p) => (
                      <Row key={p.id} label={fmtDateTime(p.created_at)}>
                        {fmtMoney(p.amount)} · {p.status}
                      </Row>
                    ))
                  ) : (
                    <p className="py-2 text-xs text-ink-muted">None.</p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  Recent searches ({data.searches.length})
                </h3>
                <div className="rounded-xl border border-line bg-surface-1 px-4 py-2">
                  {data.searches.length ? (
                    data.searches.map((s) => (
                      <Row key={s.id} label={fmtDateTime(s.created_at)}>
                        {s.query || "(not recorded)"}
                      </Row>
                    ))
                  ) : (
                    <p className="py-2 text-xs text-ink-muted">None.</p>
                  )}
                </div>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  <KeyRound className="h-3 w-3" /> Set a new password
                </h3>
                <p className="mb-2 text-xs text-ink-muted">
                  The current password cannot be shown — it is stored only as a
                  one-way bcrypt hash. You can replace it here and tell the user
                  the new one.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="at least 6 characters"
                    className="flex-1 rounded-xl border border-line bg-surface-1 px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={doReset}
                    disabled={pw.length < 6 || busy === "pw"}
                    className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40"
                  >
                    {busy === "pw" ? "Saving…" : "Set"}
                  </button>
                </div>
                {pwDone ? (
                  <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                    Password set to <strong>{pwDone}</strong> — copy it now, it
                    will not be shown again.
                  </p>
                ) : null}
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  <UserCog className="h-3 w-3" /> Admin rights
                </h3>
                {isSelf ? (
                  <p className="text-xs text-ink-muted">
                    This is the account you are signed in as. You cannot change
                    your own admin rights — ask another admin, or use
                    backend/make_admin.py from a terminal.
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-ink-muted">
                      {u.is_admin
                        ? "This account can see and change everything on this page."
                        : "Granting admin gives this account full access to every user, payment and search on this dashboard."}{" "}
                      Confirm with <strong>your own</strong> password.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={rolePw}
                        onChange={(e) => setRolePw(e.target.value)}
                        placeholder="your password"
                        autoComplete="current-password"
                        className="min-w-0 flex-1 rounded-xl border border-line bg-surface-1 px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => doRole(!u.is_admin)}
                        disabled={!rolePw || busy === "role"}
                        className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-40 ${
                          u.is_admin
                            ? "bg-rose-600 hover:bg-rose-500"
                            : "bg-amber-600 hover:bg-amber-500"
                        }`}
                      >
                        {busy === "role"
                          ? "Saving…"
                          : u.is_admin
                            ? "Revoke admin"
                            : "Make admin"}
                      </button>
                    </div>
                    {roleMsg ? (
                      <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
                        {roleMsg}
                      </p>
                    ) : null}
                  </>
                )}
              </section>

              <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="h-3 w-3" /> Delete account
                </h3>
                <p className="mb-3 text-xs text-ink-muted">
                  Removes the account, its avatar, its watchlist and its search
                  history. Payment records are kept but detached from the user.
                  This cannot be undone.
                </p>
                {u.is_admin ? (
                  <p className="text-xs text-ink-muted">
                    Revoke this account&apos;s admin rights above before
                    deleting it.
                  </p>
                ) : confirmDelete ? (
                  <div className="flex gap-2">
                    <button
                      onClick={doDelete}
                      disabled={busy === "delete"}
                      className="flex-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
                    >
                      {busy === "delete"
                        ? "Deleting…"
                        : `Yes, delete ${u.username || u.email}`}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-xl border border-line bg-surface-1 px-3 py-2 text-xs font-semibold text-ink-muted transition hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete this account
                  </button>
                )}
              </section>
            </>
          ) : null}
        </div>
      </aside>
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
  const [auditLog, setAuditLog] = useState({ entries: [] });

  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState("all");
  const [userOffset, setUserOffset] = useState(0);
  const [payOffset, setPayOffset] = useState(0);

  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [openUser, setOpenUser] = useState(null);

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

  const loadAudit = useCallback(async () => {
    setAuditLog(await apiGet("/api/admin/audit?limit=60"));
  }, []);

  useEffect(() => {
    if (gate !== "ok") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOverview().catch((e) => setError(e.message));
  }, [gate, loadOverview]);

  useEffect(() => {
    if (gate !== "ok" || tab !== "audit") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAudit().catch((e) => setError(e.message));
  }, [gate, tab, loadAudit]);

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
      if (tab === "audit") await loadAudit();
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
        <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
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
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
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

      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:space-y-6 sm:py-8">
        {error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        {/* Stat tiles */}
        {stats ? (
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {tiles.map((t) => (
              <StatCard key={t.label} {...t} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 lg:grid-cols-3">
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

        {/* Tabs -- one scrollable row on phones rather than a wrapped block */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            { id: "users", label: "Users", icon: Users },
            { id: "payments", label: "Payments", icon: CreditCard },
            { id: "searches", label: "Search activity", icon: Search },
            { id: "audit", label: "Activity log", icon: ScrollText },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition ${
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
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or email…"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-surface-0 px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-blue-500 focus:outline-none sm:w-48 sm:flex-none"
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
            <div className="hidden overflow-x-auto lg:block">
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
                        <div className="flex items-center justify-end gap-1.5">
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
                          <button
                            onClick={() => setOpenUser(u.id)}
                            className="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-muted transition hover:text-ink"
                          >
                            Details
                          </button>
                        </div>
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
            {/* Below lg: one card per user. The 8-column table needs ~850px,
                so it only appears once there is room for it. */}
            <ul className="divide-y divide-[color:var(--line)] lg:hidden">
              {users.users.map((u) => (
                <li key={u.id} className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <Avatar user={u} size={40} ring={u.is_pro} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate font-semibold text-ink">
                          {u.username || "—"}
                        </p>
                        {u.is_admin ? <Pill tone="admin">admin</Pill> : null}
                        {u.is_pro ? (
                          <Pill tone="pro">
                            <Crown className="h-3 w-3" /> Pro
                          </Pill>
                        ) : (
                          <Pill>Free</Pill>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {u.email}
                      </p>
                      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-muted">Joined</dt>
                          <dd className="text-ink">{fmtDate(u.created_at)}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-muted">Searches</dt>
                          <dd className="text-ink">{u.search_count}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-muted">Watchlist</dt>
                          <dd className="text-ink">{u.watchlist_count}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-muted">Paid</dt>
                          <dd className="text-ink">
                            {Number(u.paid_cents) > 0
                              ? fmtMoney(u.paid_cents)
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => togglePro(u)}
                          disabled={busyId === u.id}
                          className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11px] font-semibold text-ink-muted transition hover:text-ink disabled:opacity-50"
                        >
                          {busyId === u.id
                            ? "Saving…"
                            : u.is_pro
                              ? "Revoke Pro"
                              : "Grant Pro"}
                        </button>
                        <button
                          onClick={() => setOpenUser(u.id)}
                          className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11px] font-semibold text-ink-muted transition hover:text-ink"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {users.users.length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-ink-muted">
                  No users match that filter.
                </li>
              ) : null}
            </ul>
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
            <div className="hidden overflow-x-auto lg:block">
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
            {/* Mobile: one card per payment */}
            <ul className="divide-y divide-[color:var(--line)] lg:hidden">
              {payments.payments.map((p) => (
                <li key={p.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">
                        {p.username || p.email || `user #${p.user_id ?? "?"}`}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {fmtDateTime(p.created_at)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-ink">
                        {fmtMoney(p.amount)}
                      </p>
                      <div className="mt-1">
                        <Pill tone={p.status === "paid" ? "paid" : "fail"}>
                          {p.status || "unknown"}
                        </Pill>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
              {payments.payments.length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-ink-muted">
                  No payments recorded yet.
                </li>
              ) : null}
            </ul>
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
          <div className="grid gap-5 sm:gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Panel
                title="Recent searches"
                subtitle="Newest first, with the account that ran them"
              >
                <ul className="divide-y divide-[color:var(--line)]">
                  {searches.recent.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5"
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

        {/* Activity log */}
        {tab === "audit" ? (
          <Panel
            title="Admin activity log"
            subtitle="Every privileged action taken from this dashboard"
          >
            <ul className="divide-y divide-[color:var(--line)]">
              {auditLog.entries.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      <span className="font-semibold">
                        {a.actor_label || "unknown"}
                      </span>{" "}
                      <span className="text-ink-muted">
                        {ACTION_LABEL[a.action] || a.action}
                      </span>{" "}
                      <span className="font-semibold">
                        {a.target_label || `#${a.target_id ?? "?"}`}
                      </span>
                    </p>
                    {a.detail ? (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {a.detail}
                      </p>
                    ) : null}
                  </div>
                  <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[10px] text-ink-muted sm:text-[11px]">
                    <Clock className="h-3 w-3" /> {fmtDateTime(a.created_at)}
                  </span>
                </li>
              ))}
              {auditLog.entries.length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-ink-muted">
                  Nothing recorded yet. Actions you take here will appear in
                  this list.
                </li>
              ) : null}
            </ul>
          </Panel>
        ) : null}
      </div>

      {openUser !== null ? (
        <UserDrawer
          userId={openUser}
          meId={me?.id}
          onClose={() => setOpenUser(null)}
          onChanged={() => {
            loadUsers().catch((e) => setError(e.message));
            loadOverview().catch((e) => setError(e.message));
          }}
        />
      ) : null}
    </main>
  );
}
