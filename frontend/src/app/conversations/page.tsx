import type { Metadata } from "next";
import { ConversationsScreen } from "@/components/account/ConversationsView";
import { Footer } from "@/components/Footer";
import { SITE_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: "My conversations",
  description: "Your saved conversations, by room.",
  openGraph: { title: `My conversations · ${SITE_NAME}`, url: "/conversations" },
  robots: { index: false },
};

/** /conversations (signed-in users; accounts are optional). */
export default function Page() {
  return (
    <>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="mb-8 font-display text-4xl font-semibold tracking-tight">My conversations</h1>
        <ConversationsScreen />
      </main>
      <Footer />
    </>
  );
}
