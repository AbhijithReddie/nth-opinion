import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * Shared button styles. Use <Button> for actions and <ButtonLink> for navigation;
 * both take the same `variant` and `size`.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-arena-950 font-semibold hover:bg-[#9d90ff] shadow-[0_8px_30px_-12px_var(--color-brand)] disabled:bg-arena-600 disabled:text-muted disabled:shadow-none",
  secondary: "border border-white/10 bg-white/[0.04] text-ink font-semibold hover:border-white/25 hover:bg-white/[0.08]",
  ghost: "text-muted hover:bg-white/[0.06] hover:text-ink",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  return `inline-flex shrink-0 items-center justify-center transition focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-arena-950 focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

type Common = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className = "", type = "button", ...props }: Common & ComponentProps<"button">) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant, size, className = "", ...props }: Common & ComponentProps<typeof Link>) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
