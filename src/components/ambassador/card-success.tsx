"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AmbassadorStatus } from "@/lib/ambassador/config";
import { linkedInShareUrl } from "@/lib/ambassador/share";

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
  const firstName = fullName.trim().split(/\s+/)[0];

  async function downloadCard() {
    try {
      const res = await fetch(cardUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mint-ambassador-card.jpg";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Same-origin storage fetch failing is unusual; falling back to a plain link
      // still gets the student their card.
      window.open(cardUrl, "_blank", "noopener");
    }
  }

  async function copyCaption(network: string) {
    try {
      await navigator.clipboard.writeText(shareCaption);
      toast.success(`Caption copied — paste it into your ${network} post.`);
    } catch {
      // Clipboard access needs a secure context and can be denied outright.
      toast.message(`Copy this caption for ${network}`, { description: shareCaption });
    }
  }

  /**
   * LinkedIn cannot be handed post text by a third-party site: its share intent takes
   * only a URL and builds the preview from that page's Open Graph tags. So we do the
   * same thing as Instagram -- caption on the clipboard, card in the downloads folder
   * -- and then open the composer with the card page attached.
   */
  async function shareLinkedIn() {
    setBusy(true);
    await copyCaption("LinkedIn");
    await downloadCard();
    window.open(linkedInShareUrl(cardPageUrl), "_blank", "noopener,width=600,height=700");
    setBusy(false);
  }

  async function shareInstagram() {
    setBusy(true);
    // Instagram has no web share intent for feed posts at all, so the handoff is
    // manual by necessity.
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
        <Button size="lg" onClick={downloadCard} className="w-full">
          <Download className="size-4" />
          Download card
        </Button>

        {/* Two children sharing one row need flex-1, not w-full -- w-full makes each
            100% of the container, so together they overflow it. */}
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
      </div>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Neither network lets us pre-fill a post, so we copy your caption to the clipboard
        and download the card — paste the caption and attach the image.
      </p>
    </div>
  );
}
