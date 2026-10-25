import type { Metadata } from "next";
import { Arena } from "@/components/Arena";
import { Footer } from "@/components/Footer";
import { getRoom } from "@/config/rooms";

const room = getRoom("debate");

export const metadata: Metadata = {
  title: room.title,
  description:
    "Pick a topic and watch two AI debaters argue it out live, then get a scored verdict from an AI judge.",
  openGraph: { title: `${room.title} · Huddle`, description: room.description, url: room.href },
};

export default function DebatePage() {
  return (
    <>
      <main id="main" className="relative mx-auto w-full max-w-5xl flex-1 px-4 pt-12 pb-20 sm:px-6 sm:pt-16">
        {/* Faint floor grid behind the hero. */}
        <div aria-hidden className="arena-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem]" />
        <Arena />
      </main>
      <Footer />
    </>
  );
}
