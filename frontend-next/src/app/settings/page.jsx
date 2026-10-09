"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Check,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// Centre-crop to a square and shrink before upload, so a 4MB phone photo
// becomes ~30KB and the server never sees the original.
async function toSquareDataUrl(file, size = 256) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext("2d")
    .drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const fileRef = useRef(null);

  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
  });

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

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError("");
    setSaved("");
    try {
      const dataUrl = await toSquareDataUrl(file);
      const res = await fetch(`${API_BASE}/api/auth/me/avatar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ data_url: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setUser((u) => ({
        ...u,
        has_avatar: true,
        avatar_updated_at: new Date().toISOString(),
      }));
      setSaved("Photo updated");
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    setUploading(true);
    setError("");
    setSaved("");
    try {
      await fetch(`${API_BASE}/api/auth/me/avatar`, {
        method: "DELETE",
        headers: authHeader(),
      });
      setUser((u) => ({
        ...u,
        has_avatar: false,
        avatar_updated_at: new Date().toISOString(),
      }));
      setSaved("Photo removed");
    } catch {
      setError("Could not remove photo");
    } finally {
      setUploading(false);
    }
  };

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
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Update failed");

      setUser((u) => ({ ...u, ...data }));
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
  const hasChanges =
    username !== (user.username || "") ||
    email !== (user.email || "") ||
    Boolean(newPassword);

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
          className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${
            user.is_pro
              ? "bg-blue-500/10 border-blue-500/30"
              : "bg-surface-1 border-line"
          }`}
        >
          <Sparkles
            className={`w-4 h-4 mt-0.5 shrink-0 ${
              user.is_pro ? "text-blue-400" : "text-ink-muted"
            }`}
          />
          <div>
            <p
              className={`text-sm font-semibold ${
                user.is_pro ? "text-blue-400" : "text-ink"
              }`}
            >
              {user.is_pro ? "Pro Pass active" : "Free plan"}
            </p>
            <p className="text-xs text-ink-muted mt-0.5">
              {user.is_pro
                ? "Lifetime access. Unlimited semantic searches across both catalogues."
                : "20 searches per 24 hours. Upgrade for unlimited access."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 mb-8 p-5 rounded-2xl bg-surface-1 border border-line">
          <div className="relative">
            <Avatar user={user} size={76} ring={user.is_pro} />
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-surface-0/70">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {user.username || user.email}
            </p>
            <p className="text-xs text-ink-muted mb-3">
              JPEG, PNG or WebP. Cropped square and saved immediately.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="px-3 py-1.5 rounded-lg bg-surface-2 border border-line text-xs font-semibold hover:border-blue-500 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Camera className="w-3.5 h-3.5" />
                {user.has_avatar ? "Change" : "Upload"}
              </button>
              {user.has_avatar && (
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={uploading}
                  className="px-3 py-1.5 rounded-lg bg-surface-2 border border-line text-xs font-semibold text-ink-muted hover:text-rose-400 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              )}
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={pickFile}
            className="hidden"
          />
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
            disabled={saving || !hasChanges}
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
