import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_TAGLINE } from "@/config/site";

/** The web app manifest (served at /manifest.webmanifest), so Nth Opinion can be installed as an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_TAGLINE,
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Chai & Sage canvas, matching the page background and the viewport theme colour.
    theme_color: "#fbf7f0",
    background_color: "#fbf7f0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
