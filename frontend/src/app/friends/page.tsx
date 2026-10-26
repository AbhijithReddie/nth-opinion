import type { Metadata } from "next";
import { FriendsManager } from "@/components/friends/FriendsManager";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "My Friends",
  description: "Build your own AI friend from a short description, then invite them into any Nth Opinion room.",
  openGraph: { title: "My Friends · Nth Opinion", url: "/friends" },
};

/** /friends: build, edit and delete the user's own personas (saved in this browser). */
export default function FriendsPage() {
  return (
    <>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <header className="animate-fade-up mb-8">
          <p className="font-mono text-[11px] tracking-[0.2em] text-primary-deep uppercase">Build your own friend</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">My Friends</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            Describe someone (a strict dad, a calm mentor, an elder sister who roasts you) and get an AI friend with their
            own personality and avatar. Add them to the Group Chat, or invite them as a guest into any room. They&apos;re
            saved in this browser only.
          </p>
        </header>
        <FriendsManager />
      </main>
      <Footer />
    </>
  );
}
