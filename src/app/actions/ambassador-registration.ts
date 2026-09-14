"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
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
  full_name: z.string().trim().min(2, "Enter your full name.").max(120),
  university: z.string().trim().min(2, "Enter your university.").max(160),
  batch_year: z.coerce.number().int().min(2000).max(2100),
});

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
    university: formData.get("university"),
    batch_year: formData.get("batch_year"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  }

  const admin = createAdminClient();

  const { data: campaign, error: campaignError } = await admin
    .from("ambassador_campaigns")
    .select("id, status, share_caption")
    .eq("tracking_code", trackingCode)
    .maybeSingle();

  if (campaignError || !campaign || campaign.status !== "active") {
    return { error: "This registration link is no longer active." };
  }

  const { full_name, university, batch_year } = parsed.data;
  const status = classifyBatch(batch_year);

  const requestHeaders = await headers();

  const { data: ambassador, error: insertError } = await admin
    .from("mint_ambassadors")
    .insert({
      campaign_id: campaign.id,
      full_name,
      university,
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
    const jpg = await generateAmbassadorCardJpg({ fullName: full_name, university, batchYear: batch_year });
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
