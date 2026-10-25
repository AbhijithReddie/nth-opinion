import { Footer } from "@/components/Footer";
import { BuiltWith } from "@/components/home/BuiltWith";
import { HomeHero } from "@/components/home/HomeHero";
import { HowHuddleWorks } from "@/components/home/HowHuddleWorks";
import { RoomGrid } from "@/components/home/RoomGrid";

/** Home: hero, the room grid, how it works, and the tech stack. Title/description come from the root layout. */
export default function Home() {
  return (
    <>
      <main id="main" className="relative mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <HomeHero />
        <RoomGrid />
        <HowHuddleWorks />
        <BuiltWith />
      </main>
      <Footer />
    </>
  );
}
