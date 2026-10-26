import type { Metadata } from "next";
import { SettingsScreen } from "@/components/account/SettingsView";
import { Footer } from "@/components/Footer";
import { SITE_NAME } from "@/config/site";

export const metadata: Metadata = {
  title: "Settings",
  description: "Your profile, your data and your account.",
  openGraph: { title: `Settings · ${SITE_NAME}`, url: "/settings" },
  robots: { index: false },
};

/** /settings (signed-in users; accounts are optional). */
export default function Page() {
  return (
    <>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="mb-8 font-display text-4xl font-semibold tracking-tight">Settings</h1>
        <SettingsScreen />
      </main>
      <Footer />
    </>
  );
}
