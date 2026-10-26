"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshIcon } from "../icons";
import "./installPrompt"; // starts listening for the install prompt early

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/**
 * Registers the service worker (public/sw.js) in production builds, and shows a
 * small "A new version is available" toast when a new deploy is waiting. Nothing
 * reloads until the user taps Refresh.
 *
 * In development the worker is NOT registered, and any left over from a local
 * production run is removed, so `next dev` never serves stale cached files.
 */
export function PwaManager() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const refreshing = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => void r.unregister()));
      void caches?.keys().then((keys) => keys.filter((k) => k.startsWith("nth-opinion-")).forEach((k) => void caches.delete(k)));
      return;
    }

    // Only reload when the user asked for the new version (not when a first install takes control).
    const onControllerChange = () => {
      if (refreshing.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void navigator.serviceWorker.register(`/sw.js?v=${VERSION}`).then((reg) => {
      // A new worker matters only if an older one already controls this page.
      const offer = (worker: ServiceWorker | null) => worker && navigator.serviceWorker.controller && setWaiting(worker);
      offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => worker.state === "installed" && offer(worker));
      });
    });
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (!waiting) return null;
  return (
    <div
      role="status"
      className="animate-fade-up fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-line bg-surface py-2.5 pr-2.5 pl-4 text-sm shadow-lift"
    >
      <span className="font-medium">A new version is available</span>
      <button
        type="button"
        onClick={() => {
          refreshing.current = true;
          waiting.postMessage({ type: "SKIP_WAITING" });
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primary-deep focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
      >
        <RefreshIcon className="size-3.5" /> Refresh
      </button>
      <button
        type="button"
        onClick={() => setWaiting(null)}
        aria-label="Later"
        className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-sand hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
      >
        Later
      </button>
    </div>
  );
}
