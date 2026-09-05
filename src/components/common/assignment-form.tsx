"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ASSIGNMENT_STATUSES, LOCATION_TYPES,
  type QrAssignment, type TeamMember,
} from "@/lib/types";
import type { ActionResult } from "@/app/actions/team-members";

/**
 * Single-page form. On create this also mints both QR codes and the reference code, so
 * one submit produces something immediately printable.
 */
export function AssignmentForm({
  action, members, assignment, submitLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  members: Pick<TeamMember, "id" | "full_name" | "city" | "status">[];
  assignment?: QrAssignment;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const isEdit = !!assignment;

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="team_member_id">
              Team member <span className="text-destructive">*</span>
            </Label>
            <select
              id="team_member_id"
              name="team_member_id"
              required
              defaultValue={assignment?.team_member_id ?? ""}
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="" disabled>Select a team member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                  {m.city ? ` — ${m.city}` : ""}
                  {m.status === "inactive" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            {isEdit && (
              <p className="text-muted-foreground text-xs">
                Reassigning transfers this standee&apos;s future scans to the new member.
                Tracking codes stay the same, so printed standees keep working.
              </p>
            )}
          </div>

          <Field
            label="Assignment title" name="title" required autoFocus
            defaultValue={assignment?.title}
            placeholder="DHA Phase 5 Flats — Gate 2"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Location name" name="location_name"
              defaultValue={assignment?.location_name ?? ""}
              placeholder="Bahria Town Society"
            />
            <div className="space-y-2">
              <Label htmlFor="location_type">Location type</Label>
              <select
                id="location_type"
                name="location_type"
                defaultValue={assignment?.location_type ?? ""}
                className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="">—</option>
                {LOCATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" name="city" defaultValue={assignment?.city ?? ""} placeholder="Lahore" />
            <Field label="Area" name="area" defaultValue={assignment?.area ?? ""} placeholder="Phase 5" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Campaign start" name="campaign_start_date" type="date"
              defaultValue={assignment?.campaign_start_date ?? ""}
            />
            <Field
              label="Campaign end" name="campaign_end_date" type="date"
              defaultValue={assignment?.campaign_end_date ?? ""}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={assignment?.status ?? "draft"}
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {ASSIGNMENT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={assignment?.notes ?? ""} />
          </div>

          {state.error && (
            <p role="alert" className="text-destructive text-sm">{state.error}</p>
          )}

          {!isEdit && (
            <p className="text-muted-foreground text-xs">
              Creating this assignment also generates its iOS and Android tracking codes
              and a unique reference code.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              render={<Link href={assignment ? `/assignments/${assignment.id}` : "/assignments"} />}
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
