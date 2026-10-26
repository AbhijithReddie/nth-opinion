const OPTIONS = [1, 2, 3];

/** Segmented 1 / 2 / 3 control for the number of rounds (a radio group for screen readers). */
export function RoundsSelector({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (rounds: number) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="flex items-center gap-3">
      <legend className="sr-only">Number of rounds</legend>
      <span aria-hidden className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
        Rounds
      </span>
      <div className="flex rounded-xl border border-line-strong bg-sand p-1">
        {OPTIONS.map((n) => (
          <label
            key={n}
            className={`grid h-9 w-10 cursor-pointer place-items-center rounded-lg font-mono text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-judge-deep/60 ${
              value === n ? "bg-judge text-ink font-semibold shadow-soft" : "text-muted hover:text-ink"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <input
              type="radio"
              name="rounds"
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            {n}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
