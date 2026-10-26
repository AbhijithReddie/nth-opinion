"use client";

import { useState } from "react";
import type { ReportInput } from "@/lib/report";
import { DownloadIcon } from "../icons";
import { Button } from "../ui/Button";

/** "Download PDF report": the report is built in the browser (the PDF library loads on the first click). */
export function DownloadReportButton({ input }: { input: () => ReportInput }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const { downloadReport } = await import("@/lib/report");
      await downloadReport(input());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-center">
      <Button variant="secondary" size="sm" onClick={download} disabled={busy}>
        <DownloadIcon className="size-4" /> {busy ? "Preparing PDF..." : "Download PDF report"}
      </Button>
      {failed && (
        <span role="alert" className="mt-1 text-xs text-con-deep">
          Couldn&apos;t make the PDF. Please try again.
        </span>
      )}
    </span>
  );
}
