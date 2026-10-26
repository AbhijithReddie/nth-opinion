import { roomOgImage } from "@/lib/og";

// This room's link preview on X (1200x630), drawn by lib/og.tsx.
export const alt = "Roast & Toast on Nth Opinion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return roomOgImage("roast-and-toast");
}
