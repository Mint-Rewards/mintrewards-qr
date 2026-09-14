"use client";

import { useActionState } from "react";
import {
  submitAmbassadorRegistration,
  type AmbassadorRegistrationResult,
} from "@/app/actions/ambassador-registration";
import { batchYearOptions } from "@/lib/ambassador/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmbassadorCardSuccess } from "./card-success";

const initialState: AmbassadorRegistrationResult = {};

/**
 * The public registration form. On success it swaps in the card/share view in place
 * rather than navigating away -- this is almost always opened on a phone straight
 * from a scanned QR code, so there is no admin session or "detail page" to redirect
 * to the way the internal assignment forms do.
 */
export function AmbassadorRegistrationForm({ trackingCode }: { trackingCode: string }) {
  const action = submitAmbassadorRegistration.bind(null, trackingCode);
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.success) {
    return <AmbassadorCardSuccess {...state.success} />;
  }

  const years = batchYearOptions();

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="full_name">
              Full name <span className="text-destructive">*</span>
            </Label>
            <Input id="full_name" name="full_name" required autoFocus placeholder="Your full name" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="university">
              University <span className="text-destructive">*</span>
            </Label>
            <Input id="university" name="university" required placeholder="e.g. LUMS" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="batch_year">
              Batch (year of admission) <span className="text-destructive">*</span>
            </Label>
            <select
              id="batch_year"
              name="batch_year"
              required
              defaultValue=""
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="" disabled>Select your batch…</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {state.error && (
            <p role="alert" className="text-destructive text-sm">{state.error}</p>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Submitting…" : "Join as a Mint Ambassador"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
