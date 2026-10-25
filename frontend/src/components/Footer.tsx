import Link from "next/link";
import { LIVE_ROOMS } from "@/config/rooms";
import { DISCLAIMER, GITHUB_URL, SITE_NAME, SITE_TAGLINE } from "@/config/site";
import { HuddleMark } from "./brand/HuddleMark";
import { GitHubIcon } from "./icons";

/** Site footer: brand, quick links, the disclaimer and tech credits. */
export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-arena-950/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:outline-none">
            <HuddleMark className="size-8" />
            <span className="font-display text-lg font-extrabold">{SITE_NAME}</span>
          </Link>
          <p className="mt-2 text-sm text-muted">{SITE_TAGLINE}</p>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-faint">{DISCLAIMER}</p>
        </div>

        <FooterLinks title="Live rooms" links={LIVE_ROOMS.map((r) => ({ href: r.href, label: r.title }))} />
        <FooterLinks
          title="Huddle"
          links={[
            { href: "/", label: "Home" },
            { href: "/about", label: "About" },
          ]}
        >
          <li>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-muted transition hover:text-ink">
              <GitHubIcon className="size-4" /> GitHub
            </a>
          </li>
        </FooterLinks>
      </div>
      <div className="border-t border-white/[0.04]">
        <p className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-faint sm:px-6 sm:text-left">
          Built with LangGraph, LangSmith, FastAPI and Next.js
        </p>
      </div>
    </footer>
  );
}

function FooterLinks({
  title,
  links,
  children,
}: {
  title: string;
  links: { href: string; label: string }[];
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-[0.2em] text-faint uppercase">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-muted transition hover:text-ink">
              {l.label}
            </Link>
          </li>
        ))}
        {children}
      </ul>
    </div>
  );
}
