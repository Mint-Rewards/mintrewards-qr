import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_CODE_ATTEMPTS,
  UNIQUE_VIOLATION,
  generateReferenceCode,
  generateTrackingCode,
} from "@/lib/tracking-code";
import { buildTrackingUrl, destinationUrlFor } from "@/lib/env";

export type Platform = "ios" | "android";

export interface CreateAssignmentInput {
  team_member_id: string;
  title: string;
  location_name?: string | null;
  location_type?: string | null;
  city?: string | null;
  area?: string | null;
  campaign_start_date?: string | null;
  campaign_end_date?: string | null;
  status?: string;
  notes?: string | null;
}

/**
 * Creates an assignment together with its iOS and Android QR codes.
 *
 * Every assignment gets exactly two codes (enforced by a UNIQUE (assignment_id, platform)
 * constraint), created in the same operation so an assignment can never exist in a state
 * where a standee cannot be generated.
 *
 * Uniqueness of tracking codes is guaranteed by the UNIQUE constraint, not a pre-flight
 * SELECT -- a pre-check is racy when two admins create assignments concurrently. We
 * generate, insert, and retry only on a genuine 23505. At 60 bits of entropy a retry is
 * effectively never needed; it exists so that if it ever happens the admin sees success
 * rather than an error.
 */
export async function createAssignmentWithQrCodes(
  supabase: SupabaseClient,
  input: CreateAssignmentInput,
  createdBy: string | null,
) {
  const assignment = await insertWithUniqueRetry(async () => {
    const { data, error } = await supabase
      .from("qr_assignments")
      .insert({
        ...input,
        status: input.status ?? "draft",
        reference_code: generateReferenceCode(),
        created_by: createdBy,
      })
      .select()
      .single();
    return { data, error };
  }, "reference_code");

  try {
    const codes = await Promise.all(
      (["ios", "android"] as Platform[]).map((platform) =>
        insertWithUniqueRetry(async () => {
          const trackingCode = generateTrackingCode();
          const { data, error } = await supabase
            .from("qr_codes")
            .insert({
              assignment_id: assignment.id,
              team_member_id: input.team_member_id,
              platform,
              tracking_code: trackingCode,
              tracking_url: buildTrackingUrl(platform, trackingCode),
              destination_url: destinationUrlFor(platform),
              status: "active",
            })
            .select()
            .single();
          return { data, error };
        }, "tracking_code"),
      ),
    );
    return { assignment, qrCodes: codes };
  } catch (err) {
    // An assignment with no QR codes is useless and confusing in the list view.
    // Postgres has no transaction across separate PostgREST calls, so roll back by hand.
    await supabase.from("qr_assignments").delete().eq("id", assignment.id);
    throw err;
  }
}

async function insertWithUniqueRetry<T>(
  attempt: () => Promise<{ data: T | null; error: { code?: string; message: string } | null }>,
  label: string,
): Promise<T> {
  let lastError: { code?: string; message: string } | null = null;

  for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
    const { data, error } = await attempt();
    if (!error && data) return data;
    lastError = error;
    // Only a unique violation is worth retrying -- a new random code may succeed.
    // Anything else (bad FK, RLS denial, network) will fail identically on retry.
    if (error?.code !== UNIQUE_VIOLATION) break;
  }

  throw new Error(
    `Failed to insert ${label} after ${MAX_CODE_ATTEMPTS} attempts: ${lastError?.message ?? "unknown error"}`,
  );
}
