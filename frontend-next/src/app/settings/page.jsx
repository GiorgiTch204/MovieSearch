"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Check, Sparkles } from "lucide-react";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => {
        if (!u) return;
        setUser(u);
        setUsername(u.username || "");
        setEmail(u.email || "");
      })
      .catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved("");

    const body = {};
    if (username !== (user?.username || "")) body.username = username;
    if (email !== (user?.email || "")) body.email = email;
    if (newPassword) {
      body.new_password = newPassword;
      body.current_password = currentPassword;
    }

    if (Object.keys(body).length === 0) {
      setError("Nothing to update");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Update failed");

      setUser(data);
      setCurrentPassword("");
      setNewPassword("");
      setSaved("Saved");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-surface-0 text-ink flex items-center justify-center">
        <p className="text-sm text-ink-muted">Sign in to view your settings.</p>
      </div>
    );
  }

  const field =
    "w-full bg-surface-0 border border-line rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-blue-500";
  const label =
    "text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-1.5";

  return (
    <div className="min-h-screen bg-surface-0 text-ink px-4 py-8">
      <div className="max-w-xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </Link>

        <h1 className="text-2xl font-bold mb-1">Account settings</h1>
        <p className="text-sm text-ink-muted mb-6">
          Member since{" "}
          {user.created_at ? String(user.created_at).slice(0, 10) : "-"}
        </p>

        <div
          className={`mb-6 p-4 rounded-xl border flex items-center gap-2.5 text-sm ${
            user.is_pro
              ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
              : "bg-surface-1 border-line text-ink-muted"
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          {user.is_pro
            ? "Pro Pass active - unlimited searches"
            : "Free plan - 20 searches per 24 hours"}
        </div>

        <form onSubmit={save} className="space-y-5">
          <div>
            <label className={label}>Username</label>
            <input
              className={field}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className={label}>Email</label>
            <input
              type="email"
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="pt-5 border-t border-line space-y-5">
            <p className="text-xs text-ink-muted">
              Leave the password fields empty to keep your current password.
            </p>
            <div>
              <label className={label}>Current password</label>
              <input
                type="password"
                className={field}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className={label}>New password</label>
              <input
                type="password"
                className={field}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
              {error}
            </p>
          )}
          {saved && (
            <p className="text-xs text-emerald-400 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> {saved}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Save changes"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
