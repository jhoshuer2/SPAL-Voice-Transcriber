"use client";

import { useEffect } from "react";

// Registers the service worker so the browser considers this installable
// as a desktop/home-screen app. Deliberately silent — nothing here is
// user-facing; the "Install app" button lives in Dashboard.tsx, driven
// by its own `beforeinstallprompt` listener.
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability still works without a successfully-registered SW
      // in some browsers, and this app has no offline-critical path, so
      // a failed registration isn't worth surfacing to anyone.
    });
  }, []);

  return null;
}
