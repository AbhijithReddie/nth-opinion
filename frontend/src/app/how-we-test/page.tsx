import type { Metadata } from "next";
import { SuiteScorecard } from "@/components/evals/SuiteScorecard";
import { Footer } from "@/components/Footer";
import { EVAL_SUITES, type EvalResults } from "@/config/evalSuites";
import { GITHUB_URL, SITE_NAME } from "@/config/site";
// Written by backend/evals/run.py after a real evaluation run. Suites missing from it show "Not run yet".
import latest from "../../../public/evals/latest.json";

export const metadata: Metadata = {
  title: "How we test",
  description: "How Nth Opinion's AI rooms are evaluated: persona consistency, safety, prompt injection, the director, judge bias, languages and speed.",
  openGraph: { title: `How we test · ${SITE_NAME}`, url: "/how-we-test" },
};

const results = latest as unknown as EvalResults;

/** /how-we-test: the latest evaluation results, how they're made, and their limits. */
export default function HowWeTestPage() {
  const run = EVAL_SUITES.filter((s) => results.suites[s.id]).length;
  return (
    <>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <header className="animate-fade-up max-w-3xl">
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary-deep uppercase">Evaluations</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">How we test</h1>
          <p className="mt-3 text-lg text-muted">
            A room full of AI minds is only useful if each mind stays itself, the room stays safe, and nobody can trick it.
            These are the checks we run, and what the latest real run found, small samples and all.
          </p>
          <p className="mt-3 text-sm text-muted">
            {run === 0
              ? "No suite has been run yet, so there are no numbers below. They appear after the first real run."
              : `${run} of ${EVAL_SUITES.length} suites have results${results.updated_at ? `, last updated ${new Date(results.updated_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}` : ""}.`}
          </p>
        </header>

        <nav aria-label="Suites" className="mt-8 flex flex-wrap gap-2">
          {EVAL_SUITES.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-sm transition hover:bg-sand focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
            >
              {s.title}
            </a>
          ))}
        </nav>

        <section aria-label="Results" className="mt-8 space-y-5">
          {EVAL_SUITES.map((info) => (
            <SuiteScorecard key={info.id} info={info} result={results.suites[info.id]} />
          ))}
        </section>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <section aria-labelledby="method-title" className="rounded-3xl border border-line bg-surface p-6 shadow-soft">
            <h2 id="method-title" className="font-display text-2xl font-semibold">
              Methodology
            </h2>
            <ul className="mt-3 space-y-2.5 text-[15px] text-ink/85">
              <li>
                <span className="font-semibold">Fixed test cases.</span> Every case lives in a JSON file in the repository and is synced to
                a LangSmith dataset; each run is recorded there as an experiment, so runs can be compared over time.
              </li>
              <li>
                <span className="font-semibold">Deterministic checks first.</span> Whatever can be counted is counted: did the safety
                event fire, is the text in Roman script, did a persona speak three times in a row.
              </li>
              <li>
                <span className="font-semibold">LLM-as-judge for the rest.</span> Tone, staying in character and naturalness are scored
                by a judge model, a different model from the one being tested where possible, so it isn&apos;t grading its own
                work.
              </li>
              <li>
                <span className="font-semibold">Synthetic data only.</span> Test cases are written for the evals, and document tests use
                made-up sample documents. Nothing anyone uploads is ever used.
              </li>
            </ul>
          </section>

          <section aria-labelledby="limits-title" className="rounded-3xl border border-line bg-surface p-6 shadow-soft">
            <h2 id="limits-title" className="font-display text-2xl font-semibold">
              Limitations
            </h2>
            <ul className="mt-3 space-y-2.5 text-[15px] text-ink/85">
              <li>
                <span className="font-semibold">Small samples.</span> Dozens of cases, not thousands. A few percentage points either way
                can be noise.
              </li>
              <li>
                <span className="font-semibold">Judges can be wrong.</span> An LLM judge is a useful second opinion, not ground truth,
                and it can share blind spots with the model it judges.
              </li>
              <li>
                <span className="font-semibold">Results vary.</span> The same suite can score differently between runs and between model
                versions. Treat a number as a snapshot, not a guarantee.
              </li>
              <li>
                <span className="font-semibold">Quick runs are quicker.</span> To stay within free rate limits, some results come from a
                small subset; those are marked &ldquo;quick run&rdquo;.
              </li>
            </ul>
          </section>
        </div>

        <section aria-labelledby="unit-title" className="mt-5 rounded-3xl border border-line bg-surface p-6 shadow-soft">
          <h2 id="unit-title" className="font-display text-2xl font-semibold">
            Unit tests
          </h2>
          <p className="mt-3 text-[15px] text-ink/85">
            Separately from the evaluations, automatic checks run on GitHub for every change, without any AI calls or API keys: request
            validation, custom persona and document checks (including a fake PDF that is really an image), the streaming event format,
            the rate limiter, and that untrusted text always stays inside its fenced section of the prompt. On the website side, tests
            cover the streaming parser and the timing of demo replays, and the code is linted.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
            <a href={`${GITHUB_URL}/tree/main/backend/evals`} target="_blank" rel="noreferrer" className="text-primary-deep underline underline-offset-4">
              The evaluation suites on GitHub
            </a>
            <a href={`${GITHUB_URL}/actions/workflows/tests.yml`} target="_blank" rel="noreferrer" className="text-primary-deep underline underline-offset-4">
              Latest test runs
            </a>
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
