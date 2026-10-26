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
    "bg-primary text-white font-semibold shadow-[0_10px_24px_-12px_var(--color-primary)] hover:bg-primary-deep disabled:bg-sand-deep disabled:text-muted disabled:shadow-none",
  secondary: "border border-line-strong bg-surface text-ink font-semibold shadow-soft hover:border-ink/25 hover:bg-sand",
  ghost: "text-muted hover:bg-sand hover:text-ink",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-base rounded-xl gap-2",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  return `inline-flex shrink-0 items-center justify-center transition focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

type Common = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({ variant, size, className = "", type = "button", ...props }: Common & ComponentProps<"button">) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant, size, className = "", ...props }: Common & ComponentProps<typeof Link>) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
