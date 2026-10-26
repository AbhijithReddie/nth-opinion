import type { EvalMetric, EvalSuiteInfo, EvalSuiteResult } from "@/config/evalSuites";

/** A metric value as text: 92%, 4.3 / 5, 3.2 s, 0.87, 6. */
export function formatMetric(m: EvalMetric): string {
  if (m.value === null) return "n/a";
  switch (m.format) {
    case "percent":
      return `${Math.round(m.value * 100)}%`;
    case "score5":
      return `${m.value.toFixed(1)} / 5`;
    case "ms":
      return `${(m.value / 1000).toFixed(1)} s`;
    case "ratio":
      return m.value.toFixed(2);
    default:
      return Number.isInteger(m.value) ? String(m.value) : m.value.toFixed(1);
  }
}

/** 0-1 for a bar, or null for metrics without a natural maximum (times, counts). */
function fraction(m: EvalMetric): number | null {
  if (m.value === null) return null;
  if (m.format === "percent" || m.format === "ratio") return Math.max(0, Math.min(1, m.value));
  if (m.format === "score5") return Math.max(0, Math.min(1, m.value / 5));
  return null;
}

function Meter({ metric, label }: { metric: EvalMetric; label: string }) {
  const f = fraction(metric);
  if (f === null) return null;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(f * 100)}
      aria-valuetext={formatMetric(metric)}
      className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-sand"
    >
      <div className={`h-full rounded-full ${metric.lower_is_better ? "bg-terracotta" : "bg-pro"}`} style={{ width: `${f * 100}%` }} />
      {metric.expected !== undefined && (
        <span aria-hidden className="absolute top-0 h-full w-0.5 bg-ink/60" style={{ left: `${metric.expected * 100}%` }} title="Expected by chance" />
      )}
    </div>
  );
}

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** One suite: what it tests and why, and its latest real result (or "Not run yet"). */
export function SuiteScorecard({ info, result }: { info: EvalSuiteInfo; result: EvalSuiteResult | undefined }) {
  return (
    <article id={info.id} aria-labelledby={`${info.id}-title`} className="scroll-mt-24 rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-6">
      <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
        <div className="min-w-0">
          <h3 id={`${info.id}-title`} className="font-display text-2xl font-semibold">
            {info.title}
          </h3>
          <p className="mt-2 text-[15px] text-ink/85">{info.what}</p>
          <p className="mt-2 text-sm text-muted">
            <span className="font-semibold text-ink">Why it matters: </span>
            {info.why}
          </p>
          <p className="mt-2 text-sm text-muted">
            <span className="font-semibold text-ink">How: </span>
            {info.method}
          </p>
        </div>

        {result ? (
          <div className="rounded-2xl bg-canvas p-4">
            <p className="text-xs font-medium text-muted">{result.headline.label}</p>
            <p className="mt-1 font-display text-5xl leading-none font-semibold">{formatMetric(result.headline)}</p>
            <Meter metric={result.headline} label={result.headline.label} />
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
              n = {result.sample_size} · {result.passed} passed · {result.failed} failed
              <br />
              {date(result.run_at)}
              {result.quick && " · quick run"}
            </p>
          </div>
        ) : (
          <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong bg-canvas p-4 text-center">
            <p className="font-display text-xl font-semibold text-muted">Not run yet</p>
            <p className="mt-1 text-xs text-muted">Results appear here after a real run.</p>
          </div>
        )}
      </div>

      {result && (
        <>
          {result.metrics.length > 0 && (
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {result.metrics.map((m) => (
                <div key={m.label} className="rounded-xl border border-line px-3 py-2.5">
                  <dt className="text-xs text-muted">
                    {m.label}
                    {m.lower_is_better && " (lower is better)"}
                    {m.expected !== undefined && ` (expected about ${Math.round(m.expected * 100)}%)`}
                  </dt>
                  <dd className="font-display text-lg font-semibold">{formatMetric(m)}</dd>
                  <Meter metric={m} label={m.label} />
                </div>
              ))}
            </dl>
          )}

          <p className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-sand px-2.5 py-1">Tested: {result.models.tested}</span>
            {result.models.director !== result.models.tested && <span className="rounded-full bg-sand px-2.5 py-1">Director: {result.models.director}</span>}
            <span className="rounded-full bg-lavender-soft px-2.5 py-1 text-accent-deep">Judge: {result.models.judge}</span>
          </p>
          {result.notes.map((note) => (
            <p key={note} className="mt-2 text-xs text-muted">
              {note}
            </p>
          ))}

          {result.examples.length > 0 && (
            <details className="group mt-4 rounded-2xl border border-line">
              <summary className="cursor-pointer list-none rounded-2xl px-4 py-3 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="mr-1 inline-block transition group-open:rotate-90">
                  ▸
                </span>
                Example cases ({result.examples.length})
              </summary>
              <ul className="space-y-3 border-t border-line p-4">
                {result.examples.map((ex, i) => (
                  <li key={i} className="rounded-xl bg-canvas p-3 text-sm">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                        ex.verdict === "pass" ? "bg-pro-soft text-pro-deep" : "bg-con-soft text-con-deep"
                      }`}
                    >
                      {ex.verdict === "pass" ? "Pass" : "Fail"}
                    </span>
                    <p className="mt-2 break-words">
                      <span className="font-semibold">Input: </span>
                      {ex.input}
                    </p>
                    <p className="mt-1 break-words text-ink/85">
                      <span className="font-semibold">Output: </span>
                      {ex.output}
                    </p>
                    {ex.note && <p className="mt-1 break-words text-xs text-muted">{ex.note}</p>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </article>
  );
}
