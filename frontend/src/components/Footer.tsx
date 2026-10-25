import { GitHubIcon } from "./icons";

// TODO: replace with your repository URL.
const GITHUB_URL = "https://github.com/your-username/debate-arena";

/** Site footer with the tech credits and a GitHub link. */
export function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-faint sm:flex-row">
        <p className="text-center">Built with LangGraph, LangSmith, FastAPI and Next.js</p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1 transition hover:text-ink focus-visible:ring-2 focus-visible:ring-judge/60 focus-visible:outline-none"
        >
          <GitHubIcon className="size-4" />
          View on GitHub
        </a>
      </div>
    </footer>
  );
}
