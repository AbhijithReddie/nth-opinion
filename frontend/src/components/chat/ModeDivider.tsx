import { useRoom } from "./RoomContext";

/** A centred divider marking a switch between room modes, e.g. "🥂 Toast time: real feedback". */
export function ModeDivider({ mode }: { mode: string }) {
  const { config } = useRoom();
  const text = config.modes?.find((m) => m.id === mode)?.divider ?? mode;

  return (
    <li role="separator" aria-label={text} className="animate-fade-in my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-line-strong" />
      <span className="rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-semibold text-ink shadow-soft">{text}</span>
      <span className="h-px flex-1 bg-line-strong" />
    </li>
  );
}
