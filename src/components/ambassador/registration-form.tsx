"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { IdCard } from "lucide-react";
import {
  clearRegistration,
  parseRegistration,
  readRegistrationRaw,
  subscribeToRegistration,
  writeRegistration,
  type StoredRegistration,
} from "@/lib/ambassador/registration-storage";
import {
  submitAmbassadorRegistration,
  type AmbassadorRegistrationResult,
} from "@/app/actions/ambassador-registration";
import { batchYearOptions } from "@/lib/ambassador/config";
import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PHONE_INPUT_PATTERN,
  PHONE_MAX_LENGTH,
  UNIVERSITY_MAX_LENGTH,
} from "@/lib/ambassador/validation";
import { UNIVERSITY_OTHER, type University } from "@/lib/types";
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
export function AmbassadorRegistrationForm({
  trackingCode,
  universities,
}: {
  trackingCode: string;
  universities: University[];
}) {
  const action = submitAmbassadorRegistration.bind(null, trackingCode);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [universityId, setUniversityId] = useState("");

  /**
   * localStorage does not exist on the server, so the server snapshot is null and the
   * stored value only appears after hydration -- which is what keeps the markup React
   * hydrates against identical on both sides.
   */
  const raw = useSyncExternalStore(
    subscribeToRegistration,
    () => readRegistrationRaw(trackingCode),
    () => null,
  );
  const returning = useMemo(() => parseRegistration(raw), [raw]);

  useEffect(() => {
    if (!state.success) return;
    writeRegistration(trackingCode, {
      ambassadorId: state.success.ambassadorId,
      fullName: state.success.fullName,
    });
  }, [state.success, trackingCode]);

  if (state.success) {
    return <AmbassadorCardSuccess {...state.success} />;
  }

  if (returning) {
    return (
      <ReturningAmbassador
        registration={returning}
        // A phone passed around a campus stall is the normal case, not an edge one:
        // the next student must be able to register on the same device. Clearing
        // notifies the store, so no local state needs to mirror it.
        onStartOver={() => clearRegistration(trackingCode)}
      />
    );
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
            <Input
              id="full_name"
              name="full_name"
              required
              autoFocus
              maxLength={NAME_MAX_LENGTH}
              autoComplete="name"
              placeholder="Your full name"
            />
            <p className="text-muted-foreground text-xs">
              As it should appear on your card — letters only.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              maxLength={EMAIL_MAX_LENGTH}
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
            />
            <p className="text-muted-foreground text-xs">
              Use the same email if you ever need your card again.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              Mobile number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              inputMode="tel"
              maxLength={PHONE_MAX_LENGTH}
              pattern={PHONE_INPUT_PATTERN}
              title="Enter a Pakistani mobile number, like 0300 1234567"
              placeholder="0300 1234567"
            />
            <p className="text-muted-foreground text-xs">
              Pakistani mobile, e.g. 0300 1234567 or +92 300 1234567.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="university_id">
              University <span className="text-destructive">*</span>
            </Label>
            <select
              id="university_id"
              name="university_id"
              required
              defaultValue=""
              onChange={(e) => setUniversityId(e.target.value)}
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="" disabled>Select your university…</option>
              {universities.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
              <option value={UNIVERSITY_OTHER}>Other — not listed</option>
            </select>
          </div>

          {universityId === UNIVERSITY_OTHER && (
            <div className="space-y-2">
              <Label htmlFor="university_other">
                Your university&apos;s name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="university_other"
                name="university_other"
                required
                autoFocus
                maxLength={UNIVERSITY_MAX_LENGTH}
                placeholder="Type the full name of your university"
              />
            </div>
          )}

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

/**
 * Shown when this device has registered for this campaign before, in place of a blank
 * form that would produce a duplicate.
 */
function ReturningAmbassador({
  registration,
  onStartOver,
}: {
  registration: StoredRegistration;
  onStartOver: () => void;
}) {
  const firstName = registration.fullName.trim().split(/\s+/)[0];

  return (
    <Card>
      <CardContent className="space-y-4 pt-6 text-center">
        <IdCard className="text-primary mx-auto size-8" />
        <div>
          <h2 className="font-semibold">
            {firstName ? `Welcome back, ${firstName}!` : "You're already registered"}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            You&apos;ve already joined this campaign. Your Mint Ambassador card is ready
            whenever you want to share it.
          </p>
        </div>

        <Button
          size="lg"
          className="w-full"
          render={<Link href={`/a/card/${registration.ambassadorId}`} />}
        >
          View my card
        </Button>

        <button
          type="button"
          onClick={onStartOver}
          className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
        >
          Not you? Register someone else
        </button>
      </CardContent>
    </Card>
  );
}
