import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_CODE_ATTEMPTS,
  UNIQUE_VIOLATION,
  generateReferenceCode,
  generateTrackingCode,
} from "@/lib/tracking-code";
import { buildAmbassadorUrl } from "@/lib/env";

export interface CreateAmbassadorCampaignInput {
  title: string;
  event_name?: string | null;
  event_date?: string | null;
  location_name?: string | null;
  city?: string | null;
  status?: string;
  share_caption?: string | null;
  notes?: string | null;
}

/**
 * Creates an ambassador campaign with its single QR tracking code, in one operation
 * -- same reasoning as createAssignmentWithQrCodes: a campaign should never exist
 * without the code needed to print/share its QR.
 *
 * Unlike a field assignment, there is exactly one code per campaign (it opens a
 * public form, not a platform-specific store redirect), so this is simpler than the
 * two-code, per-platform insert it's modelled on.
 */
export async function createAmbassadorCampaignWithQrCode(
  supabase: SupabaseClient,
  input: CreateAmbassadorCampaignInput,
  createdBy: string | null,
) {
  return insertWithUniqueRetry(async () => {
    const trackingCode = generateTrackingCode();
    const { data, error } = await supabase
      .from("ambassador_campaigns")
      .insert({
        ...input,
        status: input.status ?? "draft",
        reference_code: generateReferenceCode(),
        tracking_code: trackingCode,
        tracking_url: buildAmbassadorUrl(trackingCode),
        created_by: createdBy,
      })
      .select()
      .single();
    return { data, error };
  }, "tracking_code");
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
    if (error?.code !== UNIQUE_VIOLATION) break;
  }

  throw new Error(
    `Failed to insert ${label} after ${MAX_CODE_ATTEMPTS} attempts: ${lastError?.message ?? "unknown error"}`,
  );
}
