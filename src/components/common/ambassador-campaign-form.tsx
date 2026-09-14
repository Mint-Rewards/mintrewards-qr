"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AMBASSADOR_CAMPAIGN_STATUSES, type AmbassadorCampaign } from "@/lib/types";
import type { ActionResult } from "@/app/actions/team-members";

/**
 * Single-page form. On create this also mints the campaign's QR tracking code, so one
 * submit produces something immediately shareable -- same pattern as AssignmentForm.
 */
export function AmbassadorCampaignForm({
  action, campaign, submitLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  campaign?: AmbassadorCampaign;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const isEdit = !!campaign;

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Field
            label="Campaign title" name="title" required autoFocus
            defaultValue={campaign?.title}
            placeholder="World Cleanup Day 2026 — LUMS"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Event name" name="event_name"
              defaultValue={campaign?.event_name ?? ""}
              placeholder="World Cleanup Day"
            />
            <Field
              label="Event date" name="event_date" type="date"
              defaultValue={campaign?.event_date ?? ""}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Location" name="location_name"
              defaultValue={campaign?.location_name ?? ""}
              placeholder="Campus / venue name"
            />
            <Field label="City" name="city" defaultValue={campaign?.city ?? ""} placeholder="Lahore" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={campaign?.status ?? "draft"}
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {AMBASSADOR_CAMPAIGN_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              Only an <strong>active</strong> campaign&apos;s QR code accepts registrations.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="share_caption">Suggested share caption</Label>
            <Textarea
              id="share_caption"
              name="share_caption"
              rows={2}
              defaultValue={campaign?.share_caption ?? ""}
              placeholder="Leave blank to use the default MintRewards caption."
            />
            <p className="text-muted-foreground text-xs">
              Shown to ambassadors when they share their card on LinkedIn/Instagram.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={campaign?.notes ?? ""} />
          </div>

          {state.error && (
            <p role="alert" className="text-destructive text-sm">{state.error}</p>
          )}

          {!isEdit && (
            <p className="text-muted-foreground text-xs">
              Creating this campaign also generates its QR tracking code and a unique
              reference code.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              render={<Link href={campaign ? `/ambassadors/${campaign.id}` : "/ambassadors"} />}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

function Field({
  label, name, required, defaultValue, type = "text", placeholder, autoFocus,
}: {
  label: string; name: string; required?: boolean; defaultValue?: string;
  type?: string; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        id={name} name={name} type={type} required={required}
        defaultValue={defaultValue} placeholder={placeholder} autoFocus={autoFocus}
      />
    </div>
  );
}
