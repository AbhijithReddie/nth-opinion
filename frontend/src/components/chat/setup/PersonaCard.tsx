import type { Persona } from "@/config/personas";
import { NAME_MAX } from "@/config/roomChats";
import { CheckIcon } from "../../icons";
import { Avatar } from "../Avatar";

interface PersonaCardProps {
  persona: Persona;
  /** Null for rooms with a fixed cast: the card is just shown, not toggled. */
  selection: null | {
    selected: boolean;
    /** The cast is full and this persona isn't in it. */
    disabled: boolean;
    onToggle: () => void;
  };
  /** Present when the persona is in the room and can be renamed. */
  rename?: { name: string; onRename: (name: string) => void };
}

/** One persona on the setup screen: tap to add/remove (if the room lets you pick), rename once added. */
export function PersonaCard({ persona, selection, rename }: PersonaCardProps) {
  const active = selection ? selection.selected : true;
  const nameEmpty = !!rename && rename.name.trim().length === 0;

  const body = (
    <>
      <Avatar persona={persona} size="lg" />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-lg font-semibold" style={{ color: active ? persona.color : undefined }}>
          {persona.name}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">{persona.tagline}</span>
      </span>
    </>
  );

  return (
    <li
      className={`flex flex-col rounded-2xl border transition ${active ? "bg-surface" : "border-line bg-surface/60"} ${
        selection?.disabled ? "opacity-55" : ""
      }`}
      style={active ? { borderColor: `${persona.color}80`, boxShadow: `0 10px 26px -16px ${persona.color}` } : undefined}
    >
      {selection ? (
        <button
          type="button"
          aria-pressed={selection.selected}
          disabled={selection.disabled}
          onClick={selection.onToggle}
          className="flex flex-1 items-start gap-3 items-center rounded-2xl p-3.5 text-left focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none disabled:cursor-not-allowed"
        >
          {body}
          <span
            aria-hidden
            className={`grid size-6 shrink-0 place-items-center rounded-full border transition ${
              selection.selected ? "border-transparent text-white" : "border-line-strong bg-surface text-transparent"
            }`}
            style={selection.selected ? { backgroundColor: persona.color } : undefined}
          >
            <CheckIcon className="size-3.5" />
          </span>
        </button>
      ) : (
        <div className="flex flex-1 items-center gap-3 p-3.5">{body}</div>
      )}

      {rename && (
        <div className="px-3.5 pb-3.5">
          <label htmlFor={`rename-${persona.id}`} className="mb-1 block text-[11px] font-medium text-muted">
            Call them
          </label>
          <input
            id={`rename-${persona.id}`}
            value={rename.name}
            maxLength={NAME_MAX}
            onChange={(e) => rename.onRename(e.target.value)}
            aria-invalid={nameEmpty || undefined}
            placeholder={persona.name}
            className={`h-9 w-full rounded-lg border bg-canvas px-3 text-sm text-ink placeholder:text-faint focus:ring-2 focus:outline-none ${
              nameEmpty ? "border-con/60 focus:ring-con/30" : "border-line-strong focus:border-primary focus:ring-primary/20"
            }`}
          />
        </div>
      )}
    </li>
  );
}
