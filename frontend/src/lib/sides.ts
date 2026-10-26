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
    text: "text-pro-deep",
    bg: "bg-pro-soft",
    border: "border-pro/50",
    glow: "shadow-[0_12px_32px_-14px_var(--color-pro)]",
    bar: "bg-linear-to-r from-pro to-pro-deep",
  },
  con: {
    label: "Con",
    stance: "Argues against",
    text: "text-con-deep",
    bg: "bg-con-soft",
    border: "border-con/50",
    glow: "shadow-[0_12px_32px_-14px_var(--color-con)]",
    bar: "bg-linear-to-r from-con to-con-deep",
  },
};
