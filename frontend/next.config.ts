import type { NextConfig } from "next";

// A new value on every build: the service worker is registered as /sw.js?v=<this>, so each deploy
// installs a fresh worker with its own versioned caches (and the "new version" toast appears).
const APP_VERSION = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? Date.now().toString(36);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION },
  async headers() {
    // Browsers must always fetch the latest service worker script, never a cached copy.
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
  partialPrefetching: true,
  async redirects() {
    return [
      // The Shark Tank Pitch Room was renamed Pitch Tank. The backend room id stays "shark-tank".
      { source: "/rooms/shark-tank", destination: "/rooms/pitch-tank", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
