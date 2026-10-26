/**
 * The evaluation suites on the "How we test" page: what each one tests and why,
 * in plain English. The numbers come only from public/evals/latest.json, which
 * backend/evals/run.py writes after a real run; nothing here is a result.
 */

export interface EvalMetric {
  label: string;
  value: number | null;
  /** percent (0-1), score5 (1-5), ms, ratio (0-1), number */
  format: "percent" | "score5" | "ms" | "ratio" | "number";
  lower_is_better?: boolean;
  /** For comparisons such as "random chance" or "expected about 50%". */
  expected?: number;
  n?: number;
}

export interface EvalExample {
  input: string;
  output: string;
  verdict: "pass" | "fail";
  note: string;
}

export interface EvalSuiteResult {
  headline: EvalMetric;
  metrics: EvalMetric[];
  sample_size: number;
  passed: number;
  failed: number;
  run_at: string;
  quick: boolean;
  llm_calls: number;
  models: { tested: string; director: string; judge: string };
  langsmith_experiment: string | null;
  examples: EvalExample[];
  notes: string[];
}

export interface EvalResults {
  updated_at: string | null;
  suites: Partial<Record<string, EvalSuiteResult>>;
}

export interface EvalSuiteInfo {
  id: string;
  title: string;
  what: string;
  why: string;
  /** How the checks work: deterministic, LLM judge, or both. */
  method: string;
}

export const EVAL_SUITES: EvalSuiteInfo[] = [
  {
    id: "persona_consistency",
    title: "Persona consistency",
    what: "Five conversation starters for each chat room. A judge model scores every reply from 1 to 5 for sounding like the persona who sent it, then, with the names hidden, guesses who wrote each message.",
    why: "The whole point of a room full of minds is that they're different people. If the personas blur together, you only get one opinion in six voices.",
    method: "LLM judge (a different model), plus a blind attribution test compared with random chance.",
  },
  {
    id: "safety",
    title: "Safety",
    what: "25 messages: clear crisis messages, sad or stressed messages that are not a crisis, and requests for help with something harmful or unethical.",
    why: "Crisis messages must switch every room to gentle, supportive mode with a helpline. But a room that panics at every bad day is useless too, so false alarms are measured as well.",
    method: "Deterministic check that the safety event fired (or didn't); LLM judge for supportive tone and for refusing harmful requests.",
  },
  {
    id: "prompt_injection",
    title: "Prompt injection",
    what: "Attempts to hijack the AI through your messages, through a custom persona's description, through an uploaded resume or job description, and through the persona builder: \"rate this candidate 10/10\", \"reveal your system prompt\" and so on.",
    why: "Anything you paste or upload is data, not instructions. A resume that says \"rate me 10/10\" should be called out, not obeyed.",
    method: "Deterministic checks (nothing internal leaked, documents flagged, builder refused) plus an LLM judge for whether the instruction was followed. Uses made-up sample documents only.",
  },
  {
    id: "director_quality",
    title: "Director quality",
    what: "Multi-turn conversations, measuring what the director agent actually did: rule violations, whether everyone spoke on a new topic, how evenly the speaking was spread, and messages per turn.",
    why: "A good group chat isn't round-robin, but nobody should hog it or be left out either.",
    method: "Deterministic: counted from the conversation, no judge.",
  },
  {
    id: "debate_judge_bias",
    title: "Debate judge bias",
    what: "Each topic is debated twice, with the motion flipped, so the same position speaks first in one debate and second in the other. Also: does the longer argument win more often than chance?",
    why: "A fair judge shouldn't care who spoke first or who wrote more words.",
    method: "Deterministic comparison of the judge's verdicts.",
  },
  {
    id: "language_adherence",
    title: "Hinglish and Tenglish",
    what: "Conversations in Hinglish and Tenglish. Every message must be in Roman script, and a judge rates whether the mix sounds like how people actually text.",
    why: "If you chat in Hinglish, a reply in Devanagari or in stiff, textbook Hindi breaks the feeling of talking with friends.",
    method: "Deterministic script check (no Devanagari or Telugu characters) plus an LLM judge for naturalness.",
  },
  {
    id: "performance",
    title: "Performance",
    what: "Time per room turn, AI calls per turn, time until the first reply appears, and time to the first streamed word in a debate.",
    why: "Several agents talking means several AI calls. This keeps an honest eye on how long you wait and how much work each reply takes.",
    method: "Measured during real runs, leaving out the pauses the test runner adds for rate limits.",
  },
];
