"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RequireAccount } from "./RequireAccount";
import { useLanguages, savePreferredLanguage } from "@/hooks/useLanguages";
import { signOut } from "@/hooks/useAuth";
import { account, AccountError, type Profile } from "@/lib/account";
import { removeKey } from "@/lib/storage";

const CONFIRM = "delete my account";

/** /settings: display name, preferred language, export everything, delete the account. */
export function SettingsView({ userId }: { userId: string }) {
  const router = useRouter();
  const languages = useLanguages();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("english");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    account
      .profile()
      .then((p) => {
        setProfile(p);
        setName(p.display_name ?? "");
        setLanguage(p.preferred_language ?? "english");
      })
      .catch((e: AccountError) => setError(e.message));
  }, [userId]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      setProfile(await account.updateProfile({ display_name: name, preferred_language: language }));
      savePreferredLanguage(language); // new rooms start in it on this device too
      setStatus("Saved.");
    } catch (e) {
      setError(e instanceof AccountError ? e.message : "Couldn't save. Try again.");
    }
  }

  async function exportData() {
    setError(null);
    try {
      const data = await account.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: "nth-opinion-my-data.json" });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof AccountError ? e.message : "Couldn't export. Try again.");
    }
  }

  async function deleteAccount() {
    setError(null);
    try {
      await account.deleteAccount();
      removeKey(`nth-opinion.persona-move-offered.${userId}`);
      await signOut();
      router.replace("/");
    } catch (e) {
      setError(e instanceof AccountError ? e.message : "Couldn't delete your account. Try again.");
    }
  }

  if (!profile && !error) return <p role="status" className="text-muted">Loading your settings…</p>;

  const field = "h-11 w-full rounded-xl border border-line-strong bg-surface px-4 text-base text-ink focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none";
  return (
    <div className="space-y-8">
      {error && (
        <p role="alert" className="rounded-xl border border-con/30 bg-con-soft px-4 py-3 text-sm">
          {error}
        </p>
      )}
      <form onSubmit={save} className="space-y-4 rounded-3xl border border-line bg-surface p-6 shadow-soft">
        <h2 className="font-display text-xl font-semibold">Profile</h2>
        <p className="text-sm text-muted">Signed in as {profile?.email}</p>
        <div>
          <label htmlFor="display-name" className="mb-1.5 block text-sm font-semibold">
            Display name
          </label>
          <input id="display-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="preferred-language" className="mb-1.5 block text-sm font-semibold">
            Preferred language
          </label>
          <select id="preferred-language" value={language} onChange={(e) => setLanguage(e.target.value)} className={field}>
            {languages.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-deep">
            Save
          </button>
          <span role="status" className="text-sm text-muted">
            {status}
          </span>
        </div>
      </form>

      <section className="space-y-3 rounded-3xl border border-line bg-surface p-6 shadow-soft">
        <h2 className="font-display text-xl font-semibold">Your data</h2>
        <p className="text-sm text-muted">Download everything we store about you (profile, friends and saved conversations) as JSON.</p>
        <button type="button" onClick={exportData} className="h-10 rounded-xl border border-line-strong px-5 text-sm font-semibold hover:bg-sand">
          Export my data
        </button>
      </section>

      <section className="space-y-3 rounded-3xl border border-con/30 bg-con-soft/40 p-6">
        <h2 className="font-display text-xl font-semibold text-con-deep">Delete my account</h2>
        <p className="text-sm text-ink/85">
          Permanently deletes your profile, your friends and every saved conversation, then signs you out. This can&apos;t be undone.
        </p>
        <label htmlFor="confirm-delete" className="block text-sm">
          Type <strong>{CONFIRM}</strong> to confirm
        </label>
        <input id="confirm-delete" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" className={field} />
        <button
          type="button"
          disabled={confirm.trim().toLowerCase() !== CONFIRM}
          onClick={deleteAccount}
          className="h-10 rounded-xl bg-con-deep px-5 text-sm font-semibold text-white hover:bg-ink disabled:opacity-40"
        >
          Delete my account
        </button>
      </section>
    </div>
  );
}

/** The page body: asks guests to sign in first. */
export function SettingsScreen() {
  return <RequireAccount what="your settings">{(userId) => <SettingsView userId={userId} />}</RequireAccount>;
}
