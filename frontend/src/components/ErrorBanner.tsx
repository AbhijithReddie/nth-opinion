import type { ReactNode } from "react";
import { AlertIcon } from "./icons";

/** A friendly, non-technical error message with optional action buttons. */
export function ErrorBanner({
  message,
  title = "The debate couldn't continue",
  children,
}: {
  message: string;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="animate-fade-up flex flex-col gap-3 rounded-2xl border border-con/40 bg-con-soft p-4 sm:flex-row sm:items-center"
    >
      <div className="flex flex-1 items-start gap-3">
        <AlertIcon className="mt-0.5 size-5 shrink-0 text-con-deep" />
        <div>
          <p className="font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-sm text-muted">{message}</p>
        </div>
      </div>
      {children && <div className="flex shrink-0 gap-2">{children}</div>}
    </div>
  );
}
