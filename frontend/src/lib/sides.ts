/**
 * Per-side display settings. Tailwind needs full class names written out in
 * source to generate them, so they live here instead of being built from strings.
 */

import type { Speaker } from "./types";

export const SIDES: Record<
  Speaker,
  { label: string; stance: string; text: string; bg: string; border: string; glow: string; bar: string }
> = {
  pro: {
    label: "Pro",
    stance: "Argues for",
    text: "text-pro",
    bg: "bg-pro/10",
    border: "border-pro/30",
    glow: "shadow-[0_0_40px_-12px_var(--color-pro)]",
    bar: "bg-linear-to-r from-pro-deep to-pro",
  },
  con: {
    label: "Con",
    stance: "Argues against",
    text: "text-con",
    bg: "bg-con/10",
    border: "border-con/30",
    glow: "shadow-[0_0_40px_-12px_var(--color-con)]",
    bar: "bg-linear-to-r from-con-deep to-con",
  },
};
