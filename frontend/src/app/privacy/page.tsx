import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { SITE_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Nth Opinion stores, what it never stores, and how to export or delete your data.",
  openGraph: { title: `Privacy · ${SITE_NAME}`, url: "/privacy" },
};

const LAST_UPDATED = "26 October 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="space-y-2 leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

/** /privacy: plain-English privacy notes. */
export default function PrivacyPage() {
  return (
    <>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-4 py-12 sm:px-6 sm:py-16">
        <header className="animate-fade-up">
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary-deep uppercase">Privacy</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Your data, in plain English</h1>
          <p className="mt-3 text-sm text-muted">Last updated {LAST_UPDATED}</p>
        </header>

        <Section title="You don't need an account">
          <p>
            Every room works without signing in. As a guest, your chats, settings and the friends you build are kept only
            in this browser (local storage). We don&apos;t keep them on our servers.
          </p>
        </Section>

        <Section title="What we store if you sign in">
          <p>Accounts are optional. If you sign in with your email, we store:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>your email address (kept by Supabase, which runs sign-in for us);</li>
            <li>your profile: a display name and preferred language, if you set them;</li>
            <li>the friends you build on the My Friends page, so they work on any device;</li>
            <li>
              conversations, <strong>only if you turn on &ldquo;Save conversation&rdquo;</strong> in a room (it&apos;s off by
              default): who was in the room, the language, the room details you typed, the messages and the room&apos;s result.
            </li>
          </ul>
          <p>
            If a conversation touched on something difficult and the support message appeared, we ask before saving it, and
            the answer defaults to not saving.
          </p>
        </Section>

        <Section title="What we never store">
          <ul className="list-disc space-y-1 pl-5">
            <li>Uploaded files (resumes, job descriptions, pitch decks, notes) or the summaries made from them. They&apos;re read in memory and then dropped.</li>
            <li>Your camera. The self-view in call mode only shows in your own tile; it&apos;s never recorded, uploaded or sent anywhere.</li>
            <li>Your voice. Voice input uses your browser&apos;s speech service (in Chrome, Google processes the audio); we only ever receive the text.</li>
          </ul>
        </Section>

        <Section title="Who processes your messages">
          <p>
            The replies are written by Google Gemini, so the messages you send (and any document summaries) are sent to Google
            to generate them. Account data (your email, profile, friends and saved conversations) is stored in a database run by
            Supabase. If you turn on natural AI voices, the text being read aloud is also sent to Google.
          </p>
        </Section>

        <Section title="Export or delete everything">
          <p>
            Signed in, go to <Link href="/settings" className="font-semibold text-primary-deep underline">Settings</Link>:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Export my data</strong> downloads everything we store about you as a JSON file.</li>
            <li>
              <strong>Delete my account</strong> permanently deletes your profile, friends and saved conversations, and signs you
              out. You can also delete single conversations on My conversations.
            </li>
          </ul>
          <p>To have your sign-in email removed from Supabase as well, contact the site owner.</p>
        </Section>
      </main>
      <Footer />
    </>
  );
}
