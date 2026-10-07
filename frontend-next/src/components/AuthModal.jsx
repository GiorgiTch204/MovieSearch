"use client";

import React, { useState } from "react";
import { X, Lock, Mail, User, Loader2 } from "lucide-react";

export const AuthModal = ({ isOpen, onClose, onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatusMessage("");

    const apiUrl = (
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
    ).replace(/\/$/, "");

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
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex border-b border-slate-800 mb-6">
          <button
            onClick={() => {
              setIsLogin(true);
              setError("");
              setStatusMessage("");
            }}
            className={`flex-1 pb-3 text-xs font-semibold tracking-wide transition ${
              isLogin
                ? "text-indigo-400 border-b-2 border-indigo-500"
                : "text-slate-400"
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
                : "text-slate-400"
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

        {statusMessage && (
          <div className="mb-4 text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 p-2.5 rounded-lg flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {statusMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              {isLogin ? "Username or Email" : "Username"}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                placeholder={isLogin ? "user or email@example.com" : "john_doe"}
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  placeholder="name@example.com"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white transition flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
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
