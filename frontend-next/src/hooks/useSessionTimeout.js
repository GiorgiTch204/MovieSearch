"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

export function useSessionTimeout() {
  const router = useRouter();

  useEffect(() => {
    // 1. Check elapsed time when the user loads or returns to the tab
    const checkSessionExpiry = () => {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      const lastActiveTime = localStorage.getItem("last_closed_time");
      if (lastActiveTime) {
        const timeElapsed = Date.now() - parseInt(lastActiveTime, 10);

        if (timeElapsed > INACTIVITY_LIMIT_MS) {
          // Time expired: clear session
          localStorage.removeItem("auth_token");
          localStorage.removeItem("last_closed_time");

          // Optionally notify Navbar/state or redirect
          window.dispatchEvent(new Event("auth_logout"));
          router.refresh();
          return;
        }
      }

      // If within 10 minutes, clear the recorded exit time since they are active again
      localStorage.removeItem("last_closed_time");
    };

    // 2. Record the timestamp when the tab is hidden or window is closed
    const recordExitTimestamp = () => {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      if (document.visibilityState === "hidden") {
        localStorage.setItem("last_closed_time", Date.now().toString());
      } else if (document.visibilityState === "visible") {
        checkSessionExpiry();
      }
    };

    const handleBeforeUnload = () => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        localStorage.setItem("last_closed_time", Date.now().toString());
      }
    };

    // Run check immediately on mount
    checkSessionExpiry();

    // Attach lifecycle listeners
    document.addEventListener("visibilitychange", recordExitTimestamp);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", recordExitTimestamp);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [router]);
}
