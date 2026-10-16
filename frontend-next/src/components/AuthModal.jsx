"use client";

import React, { useRef, useState } from "react";
import { X, Lock, Mail, User } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { ColdStartNotice } from "@/components/ColdStartNotice";

// How long a request has to be in flight before we assume it's a cold
// start (Render/Neon waking up) rather than ordinary network latency, and
// swap the plain "signing in" text for the fuller explanation.
const COLD_START_THRESHOLD_MS = 1200;

export const AuthModal = ({ isOpen, onClose, onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const wakeTimerRef = useRef(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setWakingUp(false);
    setError("");
    setStatusMessage("");

    const apiUrl = API_BASE;

    wakeTimerRef.current = setTimeout(
      () => setWakingUp(true),
      COLD_START_THRESHOLD_MS,
    );

    try {
      if (isLogin) {
        // Direct Login Flow
        const res = await fetch(`${apiUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            username_or_email: username,
            password: password,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || "Invalid credentials");
        }

        if (data.access_token) {
          localStorage.setItem("auth_token", data.access_token);
        }

        onAuthSuccess(data);
        onClose();
      } else {
        // Step 1: Register Account
        setStatusMessage("Creating account...");
        const regRes = await fetch(`${apiUrl}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            username: username,
            email: email,
            password: password,
          }),
        });

        const regData = await regRes.json();
        if (!regRes.ok) {
          throw new Error(regData.detail || "Registration failed");
        }

        // Step 2: Auto switch tab to Sign In visually
        setIsLogin(true);
        setStatusMessage("Account created! Logging in...");

        // Step 3: Automatically log in with the new credentials
        const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            username_or_email: username,
            password: password,
          }),
        });

        const loginData = await loginRes.json();
        if (!loginRes.ok) {
          throw new Error(
            loginData.detail || "Auto-login failed. Please sign in manually.",
          );
        }

        if (loginData.access_token) {
          localStorage.setItem("auth_token", loginData.access_token);
        }

        // Authorize user and dismiss modal
        onAuthSuccess(loginData);
        onClose();
      }
    } catch (err) {
      setError(err.message);
      setStatusMessage("");
    } finally {
      clearTimeout(wakeTimerRef.current);
      setWakingUp(false);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-1 border border-line rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-muted hover:text-ink"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex border-b border-line mb-6">
          <button
            onClick={() => {
              setIsLogin(true);
              setError("");
              setStatusMessage("");
            }}
            className={`flex-1 pb-3 text-xs font-semibold tracking-wide transition ${
              isLogin
                ? "text-indigo-400 border-b-2 border-indigo-500"
                : "text-ink-muted"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setIsLogin(false);
              setError("");
              setStatusMessage("");
            }}
            className={`flex-1 pb-3 text-xs font-semibold tracking-wide transition ${
              !isLogin
                ? "text-indigo-400 border-b-2 border-indigo-500"
                : "text-ink-muted"
            }`}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
            {error}
          </div>
        )}

        {statusMessage && !wakingUp && (
          <div className="mb-4 text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-lg flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
            </span>
            {statusMessage}
          </div>
        )}

        {wakingUp && <ColdStartNotice className="mb-4" />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">
              {isLogin ? "Username or Email" : "Username"}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-ink-muted absolute left-3 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-surface-0 border border-line rounded-xl pl-9 pr-3 py-2 text-xs text-ink focus:outline-none focus:border-indigo-500"
                placeholder={isLogin ? "user or email@example.com" : "john_doe"}
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-muted absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface-0 border border-line rounded-xl pl-9 pr-3 py-2 text-xs text-ink focus:outline-none focus:border-indigo-500"
                  placeholder="name@example.com"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-muted absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-0 border border-line rounded-xl pl-9 pr-3 py-2 text-xs text-ink focus:outline-none focus:border-indigo-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-ink transition flex items-center justify-center gap-2 mt-2 disabled:opacity-80 disabled:cursor-wait"
          >
            {loading ? (
              <span className="animate-pulse">
                {wakingUp
                  ? "Still waking up…"
                  : isLogin
                    ? "Signing in…"
                    : "Creating account…"}
              </span>
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
