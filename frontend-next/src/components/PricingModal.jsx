"use client";

import { useRef, useState } from "react";
import { Check, Sparkles, X, ShieldCheck } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { ColdStartNotice } from "@/components/ColdStartNotice";

// Same cold-start threshold as AuthModal: how long before a slow request
// is treated as the free-tier API/DB waking up rather than normal latency.
const COLD_START_THRESHOLD_MS = 1200;

export function PricingModal({ isOpen, onClose, user }) {
  const [loading, setLoading] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);
  const wakeTimerRef = useRef(null);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

    if (!token) {
      alert("Please sign in before upgrading to Pro.");
      return;
    }

    setLoading(true);
    setWakingUp(false);
    wakeTimerRef.current = setTimeout(
      () => setWakingUp(true),
      COLD_START_THRESHOLD_MS,
    );

    try {
      const res = await fetch(`${API_BASE}/api/checkout/create-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.detail || "Failed to initiate payment session");
      }
    } catch (err) {
      console.error(err);
      alert("Error contacting checkout server");
    } finally {
      clearTimeout(wakeTimerRef.current);
      setWakingUp(false);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-surface-1 border border-line rounded-3xl max-w-md w-full p-6 relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-ink-muted hover:text-ink p-2 rounded-full bg-slate-800/60"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" /> MovieSearch Pro
        </div>

        <h3 className="text-2xl font-bold text-ink mb-2">
          Upgrade to Pro Pass
        </h3>
        <p className="text-xs text-ink-muted mb-6">
          Unlock unlimited semantic AI natural language search, full Georgian
          cinema archive, and watchlists.
        </p>

        <div className="flex items-baseline gap-2 mb-6">
          <span className="text-3xl sm:text-4xl font-extrabold text-ink">$9.99</span>
          <span className="text-xs text-ink-muted font-medium">
            / lifetime access
          </span>
        </div>

        <ul className="space-y-3 mb-6 text-xs text-ink">
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Multilingual Semantic Vector Search (384-dim embeddings)
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Complete Georgian Cinema Archive & Director Catalog</span>
          </li>
          <li className="flex items-center gap-2">
            <Check className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Unlimited Watchlist Syncing</span>
          </li>
        </ul>

        {wakingUp && <ColdStartNotice className="mb-4" />}

        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-ink font-semibold text-sm shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition disabled:opacity-80 disabled:cursor-wait"
        >
          {loading ? (
            <span className="animate-pulse">
              {wakingUp ? "Still waking up…" : "Contacting Stripe…"}
            </span>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4" /> Pay with Stripe
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default PricingModal;
