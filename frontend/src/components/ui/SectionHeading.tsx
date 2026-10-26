import type { ReactNode } from "react";

/** Small mono eyebrow + display heading + optional intro, used to open each page section. */
export function SectionHeading({
  eyebrow,
  title,
  children,
  id,
  align = "center",
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  id?: string;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="font-mono text-[11px] tracking-[0.2em] text-primary-deep uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-2 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {children && <p className="mt-3 text-base text-pretty text-muted sm:text-lg">{children}</p>}
    </div>
  );
}
