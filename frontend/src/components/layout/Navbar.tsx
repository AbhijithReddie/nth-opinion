"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GITHUB_URL } from "@/config/site";
import { LogoMark } from "../brand/LogoMark";
import { Wordmark } from "../brand/Wordmark";
import { GitHubIcon } from "../icons";
import { MobileMenu } from "./MobileMenu";
import { RoomsMenu } from "./RoomsMenu";

/** Sticky site navbar: logo on the left, links + Rooms dropdown on desktop, hamburger drawer on mobile. */
export function Navbar() {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition hover:bg-sand hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none ${
      pathname === href ? "text-ink" : "text-muted"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-xl">
      {/* h-16 (4rem): full-height pages such as the chat subtract this. */}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
        >
          <LogoMark className="size-9 shrink-0" />
          <Wordmark className="text-lg sm:text-xl" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          <Link href="/" className={linkClass("/")} aria-current={pathname === "/" ? "page" : undefined}>
            Home
          </Link>
          <RoomsMenu pathname={pathname} />
          <Link href="/friends" className={linkClass("/friends")} aria-current={pathname === "/friends" ? "page" : undefined}>
            My Friends
          </Link>
          <Link href="/about" className={linkClass("/about")} aria-current={pathname === "/about" ? "page" : undefined}>
            About
          </Link>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={`${linkClass("")} gap-2`}>
            <GitHubIcon className="size-4" />
            GitHub
          </a>
        </nav>

        <MobileMenu pathname={pathname} />
      </div>
    </header>
  );
}
