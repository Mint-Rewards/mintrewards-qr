"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Generate / regenerate / download the printable standee.
 *
 * The signed download URL is short-lived, so "Download" always asks the server for a
 * fresh one rather than reusing a link captured at render time.
 */
export function StandeeActions({
  assignmentId, hasStandee,
}: {
  assignmentId: string;
  hasStandee: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"generate" | "download" | null>(null);

  async function generate() {
    setBusy("generate");
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/standee`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Generation failed.");
      toast.success("Standee generated.");
      window.open(body.url, "_blank", "noopener");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy("download");
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/standee`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No standee available.");
      window.open(body.url, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={generate} disabled={busy !== null} size="sm">
        {busy === "generate" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : hasStandee ? (
          <RefreshCw className="size-4" />
        ) : (
          <FileDown className="size-4" />
        )}
        {busy === "generate"
          ? "Generating…"
          : hasStandee
            ? "Regenerate Standee"
            : "Generate Standee"}
      </Button>

      {hasStandee && (
        <Button variant="outline" size="sm" onClick={download} disabled={busy !== null}>
          {busy === "download" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
          Download PDF
        </Button>
      )}
    </div>
  );
}
