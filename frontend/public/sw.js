/*
 * Nth Opinion's service worker: hand-written (no build plugin, so it works with Turbopack).
 *
 * Registered as /sw.js?v=<build> in production builds only (components/pwa/PwaManager.tsx);
 * the version names the caches, so each deploy gets fresh ones and old ones are deleted.
 *
 * What it caches:
 *   - on install: the main pages, the offline page, icons, the manifest, report fonts and the
 *     demo replay JSON files, so the demos work offline;
 *   - while browsing: Next.js scripts and styles, fonts, images and pages, as they're used.
 * What it never touches: anything on another origin (the backend API lives there), any /api/
 * path, and Server-Sent Events streams. Those always go straight to the network.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const PREFIX = "nth-opinion-";
const SHELL = `${PREFIX}shell-${VERSION}`; // precached on install
const RUNTIME = `${PREFIX}runtime-${VERSION}`; // filled while browsing

const ROOMS = ["debate", "group-chat", "shark-tank", "interview-panel", "future-you", "roast-and-toast", "study-group"];
const PRECACHE = [
  "/",
  "/offline",
  "/debate",
  "/rooms/group-chat",
  "/rooms/pitch-tank",
  "/rooms/interview-panel",
  "/rooms/future-you",
  "/rooms/roast-and-toast",
  "/rooms/study-group",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/nth-opinion-icon.svg",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/fonts/fraunces-latin-600-normal.woff",
  "/fonts/figtree-latin-400-normal.woff",
  "/fonts/figtree-latin-600-normal.woff",
  "/fonts/ibm-plex-mono-latin-400-normal.ttf",
  ...ROOMS.map((id) => `/replays/${id}.json`),
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => Promise.all(PRECACHE.map((url) => precache(cache, url)))));
  // No skipWaiting() here: a new version waits until the user taps "Refresh" (see the message handler).
});

/**
 * Cache one file if it exists. A missing one (e.g. a room without a recording: 404) is skipped,
 * and its response body is cancelled: an unread body keeps its connection busy, and a handful of
 * them would use up the browser's connections to the site and stall the install for good
 * (which is what cache.add() does with a 404).
 */
async function precache(cache, url) {
  try {
    const response = await fetch(url, { cache: "reload" });
    if (response.ok) await cache.put(url, response);
    else await response.body?.cancel();
  } catch {
    // offline during install: it'll be cached when it's next used
  }
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Never cache API calls or live streams: they always go to the network.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if ((request.headers.get("accept") || "").includes("text/event-stream")) return;

  if (request.mode === "navigate") {
    event.respondWith(page(request));
  } else if (url.pathname.startsWith("/replays/")) {
    event.respondWith(staleWhileRevalidate(request));
  } else if (url.pathname.startsWith("/_next/static/") || /\.(?:png|svg|ico|woff2?|ttf|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request)); // fingerprinted or rarely changing files
  } else {
    event.respondWith(networkFirst(request)); // e.g. Next.js page data for client-side navigation
  }
});

/** Pages: the network first (always fresh), the cached copy when offline, else the offline page. */
async function page(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(RUNTIME)).put(request, response.clone());
    return response;
  } catch {
    return (await caches.match(request, { ignoreSearch: true })) || (await caches.match("/offline")) || Response.error();
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(RUNTIME)).put(request, response.clone());
    return response;
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(RUNTIME)).put(request, response.clone());
  return response;
}

/** Replays: answer from the cache at once (works offline), and refresh the copy in the background. */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (response.ok) await (await caches.open(RUNTIME)).put(request, response.clone());
    return response;
  });
  if (!cached) return refresh.catch(() => Response.error());
  // The page gets the cached copy; drain the unused fresh response so its connection is freed.
  refresh.then((response) => response.body?.cancel()).catch(() => {});
  return cached;
}
