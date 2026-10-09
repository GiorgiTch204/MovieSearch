"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  LogOut,
  Sparkles,
  ShieldCheck,
  Menu,
  X,
  Settings,
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
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Close the mobile menu on Escape, and lock background scroll while it is open
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

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
    setMenuOpen(false);
    if (propLogout) propLogout();
    window.location.href = "/";
  };

  const handleOpenAuth = () => {
    setMenuOpen(false);
    if (onOpenAuth) {
      onOpenAuth();
    } else {
      setInternalAuthOpen(true);
    }
  };

  const handleOpenPricing = () => {
    setMenuOpen(false);
    if (onOpenPricing) onOpenPricing();
  };

  /* Shared class strings so the desktop row and the mobile sheet stay
     visually consistent without duplicating colour decisions. */
  const pill =
    "rounded-xl text-xs font-semibold transition flex items-center gap-1.5";
  const watchlistCls = `${pill} bg-surface-1 border border-line text-ink hover:bg-surface-2`;
  const adminCls = `${pill} bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25`;
  const proCls = `${pill} bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20 select-none`;
  const upgradeCls = `${pill} bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20`;

  return (
    <>
      <header className="border-b border-line bg-surface-0/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          {/* Logo -- allowed to shrink and truncate before anything else does */}
          <Link
            href="/"
            className="flex items-center gap-2 sm:gap-2.5 group min-w-0"
            onClick={() => setMenuOpen(false)}
          >
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/20 group-hover:scale-105 transition shrink-0">
              🎬
            </div>
            <span className="font-bold text-base sm:text-lg text-ink tracking-tight truncate">
              MovieSearch{currentUser?.is_pro ? " Pro" : ""}
            </span>
          </Link>

          {/* ---------- Desktop actions (md and up) ---------- */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <ThemeToggle />

            {currentUser && (
              <Link href="/watchlist" className={`${watchlistCls} px-3 py-1.5`}>
                <Bookmark className="w-3.5 h-3.5" /> Watchlist
              </Link>
            )}

            {currentUser?.is_admin && (
              <Link href="/admin" className={`${adminCls} px-3 py-1.5`}>
                <ShieldCheck className="w-3.5 h-3.5" /> Admin
              </Link>
            )}

            {currentUser?.is_pro ? (
              <span className={`${proCls} px-3 py-1.5`}>
                <Sparkles className="w-3.5 h-3.5" /> Pro
              </span>
            ) : (
              <button
                onClick={handleOpenPricing}
                className={`${upgradeCls} px-3.5 py-1.5`}
              >
                <span>⭐</span> Upgrade to Pro
              </button>
            )}

            {currentUser ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/settings"
                  className="flex items-center gap-2 group/avatar min-w-0"
                  title="Account settings"
                >
                  <Avatar
                    user={currentUser}
                    size={30}
                    ring={currentUser.is_pro}
                  />
                  <span className="text-xs text-ink-muted group-hover/avatar:text-ink font-medium transition max-w-[12ch] lg:max-w-[20ch] truncate">
                    {currentUser.username || currentUser.email}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-ink-muted hover:text-ink p-1.5 rounded-lg hover:bg-surface-2 transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleOpenAuth}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow-sm"
              >
                Sign In
              </button>
            )}
          </div>

          {/* ---------- Mobile actions (below md) ---------- */}
          <div className="flex md:hidden items-center gap-1.5 shrink-0">
            <ThemeToggle />
            {currentUser ? (
              <>
                <Link
                  href="/settings"
                  title="Account settings"
                  onClick={() => setMenuOpen(false)}
                >
                  <Avatar
                    user={currentUser}
                    size={30}
                    ring={currentUser.is_pro}
                  />
                </Link>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  aria-expanded={menuOpen}
                  className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition"
                >
                  {menuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={handleOpenAuth}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition shadow-sm"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* ---------- Mobile dropdown sheet ---------- */}
        {menuOpen && currentUser && (
          <div className="md:hidden border-t border-line bg-surface-0">
            <div className="px-4 py-4 space-y-2">
              <div className="flex items-center gap-3 pb-3 mb-1 border-b border-line">
                <Avatar user={currentUser} size={40} ring={currentUser.is_pro} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {currentUser.username || "Account"}
                  </p>
                  <p className="text-xs text-ink-muted truncate">
                    {currentUser.email}
                  </p>
                </div>
                {currentUser.is_pro && (
                  <span className={`${proCls} ml-auto px-2.5 py-1 shrink-0`}>
                    <Sparkles className="w-3 h-3" /> Pro
                  </span>
                )}
              </div>

              <Link
                href="/watchlist"
                onClick={() => setMenuOpen(false)}
                className={`${watchlistCls} w-full justify-start px-4 py-3`}
              >
                <Bookmark className="w-4 h-4" /> Watchlist
              </Link>

              {currentUser.is_admin && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className={`${adminCls} w-full justify-start px-4 py-3`}
                >
                  <ShieldCheck className="w-4 h-4" /> Admin dashboard
                </Link>
              )}

              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className={`${watchlistCls} w-full justify-start px-4 py-3`}
              >
                <Settings className="w-4 h-4" /> Account settings
              </Link>

              {!currentUser.is_pro && (
                <button
                  onClick={handleOpenPricing}
                  className={`${upgradeCls} w-full justify-center px-4 py-3`}
                >
                  <span>⭐</span> Upgrade to Pro
                </button>
              )}

              <button
                onClick={handleLogout}
                className={`${pill} w-full justify-start px-4 py-3 border border-line text-ink-muted hover:text-ink hover:bg-surface-2`}
              >
                <LogOut className="w-4 h-4" /> Log out
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Tap-anywhere backdrop, below the header so the header stays usable */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 top-16 z-30 bg-black/20"
          onClick={() => setMenuOpen(false)}
        />
      )}

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
