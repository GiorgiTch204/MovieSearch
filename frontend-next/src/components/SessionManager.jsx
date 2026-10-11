"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

export default function SessionManager() {
  const router = useRouter();

  useEffect(() => {
    const checkSessionExpiry = () => {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      const lastClosed = localStorage.getItem("last_closed_time");
      if (lastClosed) {
        const elapsed = Date.now() - parseInt(lastClosed, 10);
        if (elapsed > INACTIVITY_LIMIT_MS) {
          // 10 minutes passed: wipe auth token and trigger logout
          localStorage.removeItem("auth_token");
          localStorage.removeItem("last_closed_time");
          window.dispatchEvent(new Event("auth_logout"));
          router.refresh();
          return;
        }
      }

      // User returned within 10 minutes: keep session alive and reset exit timestamp
      localStorage.removeItem("last_closed_time");
    };

    const handleVisibility = () => {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      if (document.visibilityState === "hidden") {
        // Tab minimized or window hidden
        localStorage.setItem("last_closed_time", Date.now().toString());
      } else if (document.visibilityState === "visible") {
        // User came back to tab
        checkSessionExpiry();
      }
    };

    const handleBeforeUnload = () => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        // User closed window or navigated away
        localStorage.setItem("last_closed_time", Date.now().toString());
      }
    };

    // Check on initial page mount/load
    checkSessionExpiry();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [router]);

  return null;
}
