const INPUT_CLASS =
  "w-full rounded-xl border border-line-strong bg-surface px-4 shadow-[inset_0_1px_2px_rgb(43_34_64/0.04)] text-base text-ink placeholder:text-faint focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none";

/** A labelled input for the setup screen (room title and context fields); `multiline` gives a large textarea. */
export function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  max,
  required,
  hint,
  multiline = false,
  rows = 10,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  max: number;
  required: boolean;
  hint?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const common = {
    id,
    value,
    maxLength: max,
    required,
    placeholder,
    "aria-describedby": hint || multiline ? `${id}-hint` : undefined,
  };
  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-display text-lg font-semibold">
        {label}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {multiline ? (
        <textarea
          {...common}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          className={`scroll-thin block resize-y py-3 font-mono text-sm leading-relaxed ${INPUT_CLASS}`}
        />
      ) : (
        <input {...common} onChange={(e) => onChange(e.target.value)} className={`h-11 ${INPUT_CLASS}`} />
      )}
      {(hint || multiline) && (
        <p id={`${id}-hint`} className="mt-1.5 flex justify-between gap-3 text-xs text-faint">
          <span>{hint}</span>
          {multiline && (
            <span className={`shrink-0 font-mono ${value.length > max * 0.9 ? "text-judge-deep" : ""}`}>
              {value.length}/{max}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
