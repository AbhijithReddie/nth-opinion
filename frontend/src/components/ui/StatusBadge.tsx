import type { RoomStatus } from "@/config/rooms";

/** "Live" (pulsing cyan dot) or "Soon" (muted) pill for rooms. */
export function StatusBadge({ status, className = "" }: { status: RoomStatus; className?: string }) {
  const live = status === "live";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium tracking-[0.14em] uppercase ${
        live ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-white/10 bg-white/[0.04] text-faint"
      } ${className}`}
    >
      {live && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {live ? "Live" : "Soon"}
    </span>
  );
}
