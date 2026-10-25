import type { FriendMeta } from "@/config/friends";
import { NAME_MAX } from "@/config/friends";
import { CheckIcon } from "../../icons";
import { Avatar } from "../Avatar";

interface FriendPickerCardProps {
  friend: FriendMeta;
  selected: boolean;
  /** Can't add more friends (the group is full) and this one isn't in it. */
  disabled: boolean;
  /** The name the user chose; shown in the rename box when selected. */
  name: string;
  onToggle: () => void;
  onRename: (name: string) => void;
}

/** One friend on the setup screen: tap to add/remove, and rename once they're in the group. */
export function FriendPickerCard({ friend, selected, disabled, name, onToggle, onRename }: FriendPickerCardProps) {
  const inputId = `rename-${friend.id}`;
  const nameEmpty = selected && name.trim().length === 0;

  return (
    <li
      className={`flex flex-col rounded-2xl border transition ${
        selected ? "bg-arena-800" : "border-white/[0.07] bg-arena-900/70"
      } ${disabled ? "opacity-45" : ""}`}
      style={selected ? { borderColor: `${friend.color}80`, boxShadow: `0 0 30px -14px ${friend.color}` } : undefined}
    >
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onToggle}
        className="flex flex-1 items-start gap-3 rounded-2xl p-3.5 text-left focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none disabled:cursor-not-allowed"
      >
        <Avatar id={friend.id} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block font-display font-bold" style={{ color: selected ? friend.color : undefined }}>
            {friend.name}
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted">{friend.tagline}</span>
        </span>
        <span
          aria-hidden
          className={`grid size-6 shrink-0 place-items-center rounded-full border transition ${
            selected ? "border-transparent text-arena-950" : "border-white/20 text-transparent"
          }`}
          style={selected ? { backgroundColor: friend.color } : undefined}
        >
          <CheckIcon className="size-3.5" />
        </span>
      </button>

      {selected && (
        <div className="px-3.5 pb-3.5">
          <label htmlFor={inputId} className="mb-1 block text-[11px] font-medium text-faint">
            Call them
          </label>
          <input
            id={inputId}
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => onRename(e.target.value)}
            aria-invalid={nameEmpty || undefined}
            placeholder={friend.name}
            className={`h-9 w-full rounded-lg border bg-arena-950/80 px-3 text-sm text-ink placeholder:text-faint focus:ring-2 focus:outline-none ${
              nameEmpty ? "border-coral/60 focus:ring-coral/30" : "border-white/10 focus:border-brand/50 focus:ring-brand/25"
            }`}
          />
        </div>
      )}
    </li>
  );
}
