"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MEMBER_STATUSES, type TeamMember } from "@/lib/types";
import type { ActionResult } from "@/app/actions/team-members";

/**
 * One page, one submit -- no wizard. Only the name is required so a member can be added
 * mid-conversation and completed later.
 */
export function TeamMemberForm({
  action, member, submitLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  member?: TeamMember;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Field label="Full name" name="full_name" required defaultValue={member?.full_name} autoFocus />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" name="phone" defaultValue={member?.phone ?? ""} placeholder="+92 300 1234567" />
            <Field label="Email" name="email" type="email" defaultValue={member?.email ?? ""} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" name="city" defaultValue={member?.city ?? ""} placeholder="Lahore" />
            <Field label="Region" name="region" defaultValue={member?.region ?? ""} placeholder="Punjab" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={member?.status ?? "active"}
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              {MEMBER_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={member?.notes ?? ""} />
          </div>

          {state.error && (
            <p role="alert" className="text-destructive text-sm">{state.error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : submitLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              render={<Link href={member ? `/team-members/${member.id}` : "/team-members"} />}
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
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
    </div>
  );
}
