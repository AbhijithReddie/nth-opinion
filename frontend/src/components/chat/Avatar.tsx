import type { Persona } from "@/config/personas";

const SIZES = { xs: "size-6 text-xs", sm: "size-8 text-base", md: "size-10 text-lg", lg: "size-14 text-2xl" };

/** A persona's round avatar: their emoji on a tint of their colour. */
export function Avatar({ persona, size = "sm", className = "" }: { persona: Persona; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full border ${SIZES[size]} ${className}`}
      style={{ backgroundColor: `${persona.color}26`, borderColor: `${persona.color}66` }}
    >
      {persona.emoji}
    </span>
  );
}
