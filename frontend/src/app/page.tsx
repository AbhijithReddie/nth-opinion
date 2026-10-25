import { Arena } from "@/components/Arena";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      {/* Faint floor grid behind the hero. */}
      <div aria-hidden className="arena-grid pointer-events-none absolute inset-x-0 top-0 h-[36rem]" />
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 pt-14 pb-20 sm:px-6 sm:pt-20">
        <Arena />
      </main>
      <Footer />
    </>
  );
}
