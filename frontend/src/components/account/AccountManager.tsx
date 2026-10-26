"use client";

import { useEffect, useRef, useState } from "react";
import { savePreferredLanguage } from "@/hooks/useLanguages";
import { useAuth } from "@/hooks/useAuth";
import { account, AccountError, onSessionExpired } from "@/lib/account";
import { clearLocalPersonas, connectAccount, disconnectAccount, localPersonas, mergePersonas, type CustomPersona } from "@/lib/customPersonas";
import { loadJson, saveJson } from "@/lib/storage";
import { openSignIn } from "./signInDialog";
import { SignInModal } from "./SignInModal";

/**
 * Account housekeeping, mounted once in the layout (renders nothing for guests):
 *  - signed in: the My Friends list comes from the account and changes sync back;
 *  - on first sign-in, offers to move friends saved in this browser to the account;
 *  - applies the account's preferred language;
 *  - says so when the session expires, or when accounts are unavailable.
 */
export function AccountManager() {
  const auth = useAuth();
  const userId = auth.user?.id ?? null;
  const [offer, setOffer] = useState<{ local: CustomPersona[]; server: CustomPersona[] } | null>(null);
  const [notice, setNotice] = useState<{ text: string; signIn?: boolean } | null>(null);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const pushRef = useRef<(list: CustomPersona[]) => void>(() => {});

  useEffect(() => onSessionExpired(() => setNotice({ text: "Your session has expired. Sign in again to keep saving.", signIn: true })), []);

  useEffect(() => {
    if (!userId) {
      disconnectAccount();
      return;
    }
    let active = true;
    // Changes are sent one after another, so the last one always wins.
    const push = (list: CustomPersona[]) => {
      saving.current = saving.current.then(() =>
        account.savePersonas(list).catch((e: AccountError) => setNotice({ text: `Your friends couldn't be saved to your account: ${e.message}` })),
      );
    };
    pushRef.current = push;
    void (async () => {
      try {
        const [server, profile] = await Promise.all([account.personas(), account.profile()]);
        if (!active) return;
        connectAccount(server, push);
        if (profile.preferred_language) savePreferredLanguage(profile.preferred_language);
        const local = localPersonas();
        const offeredKey = `nth-opinion.persona-move-offered.${userId}`;
        if (local.length && !loadJson<boolean>(offeredKey)) {
          saveJson(offeredKey, true);
          setOffer({ local, server });
        }
      } catch (e) {
        if (!active) return;
        const code = e instanceof AccountError ? e.code : "";
        if (code === "accounts_disabled") setNotice({ text: "Accounts are unavailable right now. Everything still works, saved in this browser." });
        else if (code !== "session_expired") setNotice({ text: "Couldn't load your account. Your friends in this browser still work." });
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  async function moveFriends() {
    if (!offer) return;
    const merged = mergePersonas(offer.server, offer.local);
    try {
      connectAccount(await account.savePersonas(merged), pushRef.current);
      clearLocalPersonas();
      setNotice({ text: `Moved your friends to your account (${merged.length} in total).` });
    } catch (e) {
      setNotice({ text: e instanceof AccountError ? e.message : "Couldn't move your friends. Try again later." });
    }
    setOffer(null);
  }

  return (
    <>
      <SignInModal />
      {offer && (
        <div role="dialog" aria-labelledby="move-title" className="animate-fade-up fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-line bg-surface p-4 shadow-lift">
          <h2 id="move-title" className="font-display text-lg font-semibold">
            Move your friends to your account?
          </h2>
          <p className="mt-1 text-sm text-muted">
            You made {offer.local.length} {offer.local.length === 1 ? "friend" : "friends"} in this browser. Move them to your account to use them on any device (duplicates are skipped).
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setOffer(null)} className="h-9 rounded-lg border border-line-strong px-3 text-sm font-semibold hover:bg-sand">
              Not now
            </button>
            <button type="button" onClick={moveFriends} className="h-9 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-deep">
              Move them
            </button>
          </div>
        </div>
      )}
      {notice && !offer && (
        <div role="status" className="animate-fade-up fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm shadow-lift">
          <p className="flex-1">{notice.text}</p>
          {notice.signIn && (
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                openSignIn();
              }}
              className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-deep"
            >
              Sign in
            </button>
          )}
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-semibold text-muted hover:text-ink">
            OK
          </button>
        </div>
      )}
    </>
  );
}
