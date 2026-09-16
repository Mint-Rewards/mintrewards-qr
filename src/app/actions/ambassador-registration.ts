"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { UNIVERSITY_OTHER } from "@/lib/types";
import {
  validateEmail,
  validateFullName,
  validatePhone,
  validateUniversityName,
} from "@/lib/ambassador/validation";
import { isValidTrackingCodeShape, UNIQUE_VIOLATION } from "@/lib/tracking-code";
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
  email: z.string(),
  phone: z.string(),
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

interface ExistingRegistration {
  id: string;
  full_name: string;
  ambassador_status: AmbassadorStatus;
  card_file_path: string | null;
}

async function findExistingRegistration(
  admin: SupabaseClient,
  campaignId: string,
  email: string,
): Promise<ExistingRegistration | null> {
  const { data } = await admin
    .from("mint_ambassadors")
    .select("id, full_name, ambassador_status, card_file_path")
    .eq("campaign_id", campaignId)
    .eq("email", email)
    .maybeSingle();

  // A row whose card never generated is treated as absent, so the student gets a
  // working card on this attempt rather than a link to a missing image.
  return data?.card_file_path ? (data as ExistingRegistration) : null;
}

/** The same success payload a fresh registration returns, for an existing row. */
function successFor(
  existing: ExistingRegistration,
  shareCaption: string | null,
  admin: SupabaseClient,
): AmbassadorRegistrationResult {
  const { data: pub } = admin.storage
    .from(env.AMBASSADOR_CARDS_BUCKET)
    .getPublicUrl(existing.card_file_path!);

  return {
    success: {
      ambassadorId: existing.id,
      fullName: existing.full_name,
      status: existing.ambassador_status,
      cardUrl: pub.publicUrl,
      cardPageUrl: `${qrBaseUrl()}/a/card/${existing.id}`,
      shareCaption: ambassadorShareCaption(shareCaption, existing.full_name),
    },
  };
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
    email: formData.get("email"),
    phone: formData.get("phone"),
    university_id: formData.get("university_id"),
    university_other: formData.get("university_other") ?? undefined,
    batch_year: formData.get("batch_year"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const name = validateFullName(parsed.data.full_name);
  if (!name.ok) return { error: name.error };

  const email = validateEmail(parsed.data.email);
  if (!email.ok) return { error: email.error };

  const phone = validatePhone(parsed.data.phone);
  if (!phone.ok) return { error: phone.error };

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

  /**
   * Someone re-registering with the same email gets their ORIGINAL card back rather
   * than a second row.
   *
   * This is the common case, not an abuse case: the device-level memory only works on
   * the phone they signed up on, so anyone returning from a laptop, a different
   * browser, or after clearing data lands on a blank form again. Treating the email as
   * their identity turns that into recovery instead of a duplicate.
   */
  const existing = await findExistingRegistration(admin, campaign.id, email.value);
  if (existing) {
    return successFor(existing, campaign.share_caption, admin);
  }

  const { data: ambassador, error: insertError } = await admin
    .from("mint_ambassadors")
    .insert({
      campaign_id: campaign.id,
      full_name,
      email: email.value,
      phone: phone.value,
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
    // A unique-violation here means two submissions raced each other past the check
    // above. The loser should still get the card, not an error.
    if (insertError?.code === UNIQUE_VIOLATION) {
      const raced = await findExistingRegistration(admin, campaign.id, email.value);
      if (raced) return successFor(raced, campaign.share_caption, admin);
    }
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
