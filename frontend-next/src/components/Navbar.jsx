"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clapperboard,
  Bookmark,
  User,
  LogOut,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { AuthModal } from "@/components/AuthModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/Avatar";

export const Navbar = ({
  user: propUser,
  onOpenPricing,
  onOpenAuth,
  onLogout: propLogout,
}) => {
  const [internalUser, setInternalUser] = useState(null);
  const [internalAuthOpen, setInternalAuthOpen] = useState(false);

  // Use either the user passed from page.jsx or the internally fetched user
  const currentUser = propUser !== undefined ? propUser : internalUser;

  const apiUrl = (
    process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  // Restore session on mount
  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`${apiUrl}/api/auth/me`, {
      credentials: "include",
      headers,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((userData) => {
        if (userData) setInternalUser(userData);
      })
      .catch(() => setInternalUser(null));
  }, [apiUrl]);

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
    }
    try {
      await fetch(`${apiUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Ignore network errors on logout
    }

    setInternalUser(null);
    if (propLogout) propLogout();
    window.location.href = "/";
  };

  const handleOpenAuth = () => {
    if (onOpenAuth) {
      onOpenAuth();
    } else {
      setInternalAuthOpen(true);
    }
  };

  return (
    <>
      <header className="border-b border-line bg-surface-0/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className="p-2 rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/20 group-hover:scale-105 transition"
              href="/"
            >
              🎬
            </div>
            <span className="font-bold text-lg text-ink tracking-tight">
              MovieSearch{currentUser?.is_pro ? " Pro" : ""}
            </span>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {currentUser && (
              <Link
                href="/watchlist"
                className="px-3 py-1.5 rounded-xl bg-surface-1 border border-line  text-xs font-semibold text-ink hover:text-ink hover:border-line transition flex items-center gap-1.5"
              >
                <Bookmark className="w-3.5 h-3.5" /> Watchlist
              </Link>
            )}

            {currentUser?.is_admin && (
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Admin
              </Link>
            )}

            {/* Upgrade to Pro Button */}
            {currentUser?.is_pro ? (
              <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-xs font-semibold text-white shadow-md shadow-blue-500/20 flex items-center gap-1.5 select-none">
                <Sparkles className="w-3.5 h-3.5" /> Pro
              </span>
            ) : (
              <button
                onClick={onOpenPricing}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
              >
                <span>⭐</span> Upgrade to Pro
              </button>
            )}

            {/* Auth State */}
            {currentUser ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/settings"
                  className="flex items-center gap-2 group/avatar"
                  title="Account settings"
                >
                  <Avatar
                    user={currentUser}
                    size={30}
                    ring={currentUser.is_pro}
                  />
                  <span className="text-xs text-ink-muted group-hover/avatar:text-ink font-medium transition hidden sm:inline">
                    {currentUser.username || currentUser.email}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-xs text-ink-muted hover:text-ink p-1.5 rounded-lg hover:bg-surface-2 transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleOpenAuth}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-ink transition shadow-sm"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Internal Auth Modal Fallback */}
      {!onOpenAuth && (
        <AuthModal
          isOpen={internalAuthOpen}
          onClose={() => setInternalAuthOpen(false)}
          onSuccess={(u) => setInternalUser(u)}
        />
      )}
    </>
  );
};

export default Navbar;
