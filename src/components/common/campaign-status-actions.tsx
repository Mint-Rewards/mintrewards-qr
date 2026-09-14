"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setAmbassadorCampaignStatus } from "@/app/actions/ambassador-campaigns";

/**
 * Activate / pause a campaign from its detail page.
 *
 * A campaign is created as a draft, and a draft's QR resolves to "this link isn't
 * active" -- correct, but the admin is standing on the page holding the link they just
 * made. Requiring a trip through the edit form to flip one field is the kind of
 * friction that gets a dead QR printed.
 */
export function CampaignStatusActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const isActive = status === "active";

  function change(next: "active" | "paused", message: string) {
    startTransition(async () => {
      const result = await setAmbassadorCampaignStatus(campaignId, next);
      if (result?.error) toast.error(result.error);
      else toast.success(message);
    });
  }

  if (isActive) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => change("paused", "Campaign paused. Its QR no longer opens the form.")}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />}
        Pause campaign
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => change("active", "Campaign is live. Its QR now opens the sign-up form.")}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
      Activate campaign
    </Button>
  );
}
