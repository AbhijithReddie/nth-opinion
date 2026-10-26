import { siteOgImage } from "@/lib/og";

// The home page's link preview for WhatsApp, LinkedIn and others (1200x630), drawn by lib/og.tsx.
export const alt = "Nth Opinion: Why stop at a second?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return siteOgImage();
}
