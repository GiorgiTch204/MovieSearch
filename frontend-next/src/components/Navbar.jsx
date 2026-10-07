"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Clapperboard, Bookmark, User, LogOut } from "lucide-react";
import { AuthModal } from "@/components/AuthModal";

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
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="p-2 rounded-xl bg-blue-600/10 text-blue-500 border border-blue-500/20 group-hover:scale-105 transition">
              🎬
            </div>
            <span className="font-bold text-lg text-white tracking-tight">
              MovieSearch Pro
            </span>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Upgrade to Pro Button */}
            <button
              onClick={onOpenPricing}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-md shadow-blue-500/20 transition flex items-center gap-1.5"
            >
              <span>⭐</span> Upgrade to Pro
            </button>

            {/* Auth State */}
            {currentUser ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-300 font-medium">
                  {currentUser.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-xs text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
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
