"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { UNIVERSITY_OTHER } from "@/lib/types";
import { validateFullName, validateUniversityName } from "@/lib/ambassador/validation";
import { isValidTrackingCodeShape } from "@/lib/tracking-code";
import { extractClientIp } from "@/lib/user-agent";
import { classifyBatch, type AmbassadorStatus } from "@/lib/ambassador/config";
import { generateAmbassadorCardJpg, ambassadorCardStoragePath } from "@/lib/ambassador/card";
import { ambassadorShareCaption } from "@/lib/ambassador/share";
import { env, qrBaseUrl } from "@/lib/env";

export interface AmbassadorRegistrationResult {
  error?: string;
  success?: {
    ambassadorId: string;
    fullName: string;
    status: AmbassadorStatus;
    cardUrl: string;
    cardPageUrl: string;
    shareCaption: string;
  };
}

const schema = z.object({
  full_name: z.string(),
  university_id: z.string(),
  university_other: z.string().optional(),
  batch_year: z.coerce.number().int().min(2000).max(2100),
});

/**
 * Resolves the submitted campus to a stored name plus, where possible, a reference.
 *
 * A listed university's name is read back from the row rather than taken from the
 * form, so the display name cannot be spoofed by editing the request: the client
 * chooses WHICH campus, never what it is called.
 */
async function resolveUniversity(
  admin: SupabaseClient,
  universityId: string,
  other: string | undefined,
): Promise<
  { name: string; badgeLabel: string; id: string | null } | { error: string }
> {
  if (universityId === UNIVERSITY_OTHER) {
    const validated = validateUniversityName(other ?? "");
    if (!validated.ok) return { error: validated.error };
    // No row to carry a short name, so the badge shows what they typed.
    return { name: validated.value, badgeLabel: validated.value, id: null };
  }

  const { data } = await admin
    .from("universities")
    .select("id, name, short_name, is_active")
    .eq("id", universityId)
    .maybeSingle();

  if (!data || !data.is_active) {
    return { error: "Please choose your university from the list." };
  }

  // The record keeps the full legal name; only the badge uses the short one, since a
  // full name like BUITEMS' truncates mid-word on a single centred line.
  return { name: data.name, badgeLabel: data.short_name || data.name, id: data.id };
}

/**
 * Public registration submission. No authentication -- runs from the /a/[code] form.
 *
 * Uses the service-role client deliberately: there is no client insert policy on
 * mint_ambassadors (see 0005_ambassadors_rls.sql), same asymmetry as the QR redirect
 * route's scan logging. Every value is re-validated here even though the client form
 * also validates, since a request can reach a server action directly.
 */
export async function submitAmbassadorRegistration(
  trackingCode: string,
  _prev: AmbassadorRegistrationResult,
  formData: FormData,
): Promise<AmbassadorRegistrationResult> {
  if (!isValidTrackingCodeShape(trackingCode)) {
    return { error: "This registration link is not valid." };
  }

  const parsed = schema.safeParse({
    full_name: formData.get("full_name"),
    university_id: formData.get("university_id"),
    university_other: formData.get("university_other") ?? undefined,
    batch_year: formData.get("batch_year"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const name = validateFullName(parsed.data.full_name);
  if (!name.ok) return { error: name.error };

  const admin = createAdminClient();

  const resolved = await resolveUniversity(
    admin,
    parsed.data.university_id,
    parsed.data.university_other,
  );
  if ("error" in resolved) return { error: resolved.error };

  const { data: campaign, error: campaignError } = await admin
    .from("ambassador_campaigns")
    .select("id, status, share_caption")
    .eq("tracking_code", trackingCode)
    .maybeSingle();

  if (campaignError || !campaign || campaign.status !== "active") {
    return { error: "This registration link is no longer active." };
  }

  const { batch_year } = parsed.data;
  const full_name = name.value;
  const university = resolved.name;
  const status = classifyBatch(batch_year);

  const requestHeaders = await headers();

  const { data: ambassador, error: insertError } = await admin
    .from("mint_ambassadors")
    .insert({
      campaign_id: campaign.id,
      full_name,
      university,
      university_id: resolved.id,
      batch_year,
      ambassador_status: status,
      ip_address: extractClientIp(requestHeaders),
      user_agent: requestHeaders.get("user-agent"),
    })
    .select("id")
    .single();

  if (insertError || !ambassador) {
    return { error: "Could not save your registration. Please try again." };
  }

  let cardUrl: string;
  try {
    const jpg = await generateAmbassadorCardJpg({
      fullName: full_name,
      // Badge label, not the stored name: the row keeps the full legal name.
      university: resolved.badgeLabel,
      batchYear: batch_year,
    });
    const filePath = ambassadorCardStoragePath(ambassador.id);

    const { error: uploadError } = await admin.storage
      .from(env.AMBASSADOR_CARDS_BUCKET)
      .upload(filePath, jpg, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    await admin.from("mint_ambassadors").update({ card_file_path: filePath }).eq("id", ambassador.id);

    const { data: pub } = admin.storage.from(env.AMBASSADOR_CARDS_BUCKET).getPublicUrl(filePath);
    cardUrl = pub.publicUrl;
  } catch {
    // The registration itself already succeeded and is not lost -- only the card
    // image failed. Let the admin regenerate it later rather than losing the
    // submission over a rendering hiccup.
    return { error: "Registered, but your card could not be generated. Please contact MintRewards." };
  }

  return {
    success: {
      ambassadorId: ambassador.id,
      fullName: full_name,
      status,
      cardUrl,
      cardPageUrl: `${qrBaseUrl()}/a/card/${ambassador.id}`,
      shareCaption: ambassadorShareCaption(campaign.share_caption, full_name),
    },
  };
}
