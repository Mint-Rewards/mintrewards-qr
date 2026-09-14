"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AmbassadorStatus } from "@/lib/ambassador/config";
import { linkedInShareUrl } from "@/lib/ambassador/share";

const CARD_FILE_NAME = "mint-ambassador-card.jpg";

export function AmbassadorCardSuccess({
  fullName, cardUrl, cardPageUrl, shareCaption,
}: {
  fullName: string;
  status: AmbassadorStatus;
  cardUrl: string;
  cardPageUrl: string;
  shareCaption: string;
}) {
  const [busy, setBusy] = useState(false);
  const [canShareFile, setCanShareFile] = useState(false);
  const firstName = fullName.trim().split(/\s+/)[0];

  /**
   * The card is fetched up front, not when Share is tapped.
   *
   * navigator.share() must be called during the user gesture that triggered it. On
   * iOS Safari an `await fetch(...)` beforehand breaks that chain and the share sheet
   * is silently refused, so the blob has to be ready before the tap.
   */
  const cardFile = useRef<File | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const blob = await fetch(cardUrl).then((r) => r.blob());
        if (cancelled) return;
        const file = new File([blob], CARD_FILE_NAME, { type: "image/jpeg" });
        cardFile.current = file;
        // Probe with the real file: canShare({files}) is the only trustworthy check,
        // and plenty of browsers expose navigator.share without supporting files.
        setCanShareFile(Boolean(navigator.canShare?.({ files: [file] })));
      } catch {
        // Leaves the per-network buttons as the fallback.
      }
    })();

    return () => { cancelled = true; };
  }, [cardUrl]);

  async function copyCaption(target: string) {
    try {
      await navigator.clipboard.writeText(shareCaption);
      toast.success(`Caption copied — paste it into your ${target} post.`);
    } catch {
      toast.message(`Copy this caption for ${target}`, { description: shareCaption });
    }
  }

  async function downloadCard() {
    try {
      // Read the ref before awaiting: it is mutable, so TypeScript widens it back to
      // nullable across the await boundary.
      const prefetched = cardFile.current;
      const blob: Blob = prefetched ?? (await fetch(cardUrl).then((r) => r.blob()));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = CARD_FILE_NAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(cardUrl, "_blank", "noopener");
    }
  }

  /**
   * The native share sheet, which is the only thing on a phone that actually hands the
   * IMAGE to the LinkedIn or Instagram app.
   *
   * A linkedin.com/instagram.com URL just opens a browser tab or the app's home screen
   * -- neither can carry an attachment. The OS sheet can, so on mobile this is the
   * primary path and the per-network links are the desktop fallback.
   *
   * The file is shared ALONE -- no `text`, no `title`.
   *
   * An Android share intent carrying both EXTRA_STREAM and EXTRA_TEXT leaves the
   * receiving app to choose, and LinkedIn picks the text and silently discards the
   * image: the post goes out as a caption with no card, which is the opposite of what
   * anyone wants here. Sending only the file makes it unambiguously an image share.
   *
   * The caption therefore always travels via the clipboard -- which Instagram required
   * anyway, since it ignores share-sheet text regardless.
   */
  async function nativeShare() {
    const file = cardFile.current;
    if (!file) return;

    setBusy(true);

    // Fire-and-forget: awaiting the clipboard here would break the gesture chain that
    // navigator.share() requires on iOS Safari.
    void navigator.clipboard?.writeText(shareCaption).catch(() => {});

    try {
      await navigator.share({ files: [file] });
      toast.success("Caption copied — paste it into the post.");
    } catch (err) {
      // Dismissing the sheet throws AbortError; that is not a failure worth reporting.
      if ((err as Error)?.name !== "AbortError") {
        toast.error("Could not open the share sheet. Download the card and share it manually.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function shareLinkedIn() {
    setBusy(true);
    await copyCaption("LinkedIn");
    await downloadCard();
    window.open(linkedInShareUrl(cardPageUrl), "_blank", "noopener,width=600,height=700");
    setBusy(false);
  }

  async function shareInstagram() {
    setBusy(true);
    await copyCaption("Instagram");
    await downloadCard();
    window.open("https://www.instagram.com/", "_blank", "noopener");
    setBusy(false);
  }

  return (
    <div className="space-y-5 text-center">
      <div>
        <h2 className="text-lg font-semibold">
          Welcome to the MintRewards Ambassador team, {firstName}! 🎉
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Here&apos;s your Mint Ambassador card — use it as your ID for World Cleanup Day,
          September 17th.
        </p>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cardUrl}
        alt="Your Mint Ambassador card"
        className="mx-auto w-full max-w-xs rounded-lg border shadow-sm"
      />

      <div className="flex flex-col gap-2">
        {/*
          The share sheet is the good path for BOTH networks: LinkedIn accepts the card
          from it and composes a proper image post. It is simply not always in iOS's
          suggested-apps row, which iOS ranks by the member's own app usage and a web
          page cannot influence -- hence the hint below about "More".

          The LinkedIn button stays as a guaranteed route for anyone who cannot find it
          in the sheet, and as the only route on desktop. It posts via share-offsite, so
          the card arrives as the Open Graph image of /a/card/[id] -- a link post rather
          than an image post, which is why it is secondary rather than primary.
        */}
        {canShareFile && (
          <Button size="lg" onClick={nativeShare} disabled={busy} className="w-full">
            <Share2 className="size-4" />
            {busy ? "Opening…" : "Share card"}
          </Button>
        )}

        <Button
          size="lg"
          variant={canShareFile ? "outline" : "default"}
          onClick={downloadCard}
          className="w-full"
        >
          <Download className="size-4" />
          Download card
        </Button>

        {!canShareFile && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              variant="outline"
              onClick={shareLinkedIn}
              disabled={busy}
              className="min-w-0 flex-1"
            >
              <Share2 className="size-4" />
              Share on LinkedIn
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={shareInstagram}
              disabled={busy}
              className="min-w-0 flex-1"
            >
              <Share2 className="size-4" />
              Share on Instagram
            </Button>
          </div>
        )}
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        {canShareFile
          ? "Share card opens your share sheet with the card attached — pick LinkedIn, Instagram or WhatsApp. If LinkedIn isn't in the first row, tap More to find it. Your caption is copied automatically: long-press and paste it into the post."
          : "Neither network lets us pre-fill a post, so we copy your caption to the clipboard and download the card — paste the caption and attach the image."}
      </p>
    </div>
  );
}
