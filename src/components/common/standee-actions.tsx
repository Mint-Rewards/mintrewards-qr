"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  STANDEE_LANGUAGES,
  STANDEE_LANGUAGE_LABELS,
  type StandeeLanguage,
} from "@/lib/standee/config";

interface StandeeResult {
  language: StandeeLanguage;
  url: string;
  filePath: string;
}

/**
 * Generate / regenerate both standees, and download either sheet.
 *
 * One click produces English and Urdu from the same tracking codes. Downloads always ask
 * the server for a fresh signed URL rather than reusing one captured at render time,
 * because those links expire.
 */
export function StandeeActions({
  assignmentId,
  hasStandee,
}: {
  assignmentId: string;
  hasStandee: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function generate() {
    setBusy("generate");
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/standee`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Generation failed.");

      const made = (body.standees as StandeeResult[]) ?? [];
      toast.success(
        `Generated ${made.map((s) => STANDEE_LANGUAGE_LABELS[s.language]).join(" + ")} standees.`,
      );
      // Open English first so the common case needs no extra click; the Urdu sheet is a
      // download away rather than a second popup (browsers block those anyway).
      const first = made.find((s) => s.language === "english") ?? made[0];
      if (first) window.open(first.url, "_blank", "noopener");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setBusy(null);
    }
  }

  async function download(language: StandeeLanguage) {
    setBusy(language);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/standee`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No standee available.");

      const match = (body.standees as StandeeResult[]).find((s) => s.language === language);
      if (!match) {
        throw new Error(
          `No ${STANDEE_LANGUAGE_LABELS[language]} standee yet — regenerate to create it.`,
        );
      }
      window.open(match.url, "_blank", "noopener");
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
            ? "Regenerate Standees"
            : "Generate Standees"}
      </Button>

      {hasStandee &&
        STANDEE_LANGUAGES.map((language) => (
          <Button
            key={language}
            variant="outline"
            size="sm"
            onClick={() => download(language)}
            disabled={busy !== null}
          >
            {busy === language ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileDown className="size-4" />
            )}
            {STANDEE_LANGUAGE_LABELS[language]} PDF
          </Button>
        ))}
    </div>
  );
}
