"use client";

import { CloseIcon, DownloadIcon } from "../icons";
import { dismissInstall, promptInstall, useInstallState } from "./installPrompt";

/** A subtle "Install app" button (or the iPhone hint), with a way to dismiss it for good. */
export function InstallApp() {
  const status = useInstallState();
  if (status === "hidden") return null;

  return (
    <div className="mt-4 inline-flex max-w-full items-center gap-1 rounded-xl border border-line bg-surface py-1 pr-1 pl-3 text-sm shadow-soft">
      {status === "prompt" ? (
        <button
          type="button"
          onClick={() => void promptInstall()}
          className="inline-flex items-center gap-1.5 rounded-lg py-1 font-semibold text-ink transition hover:text-primary-deep focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
        >
          <DownloadIcon className="size-4" /> Install app
        </button>
      ) : (
        <p className="text-muted">
          <span className="font-semibold text-ink">Install on iPhone:</span> tap Share, then Add to Home Screen.
        </p>
      )}
      <button
        type="button"
        onClick={dismissInstall}
        aria-label="Don't show this again"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-sand hover:text-ink focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
      >
        <CloseIcon className="size-3.5" />
      </button>
    </div>
  );
}
