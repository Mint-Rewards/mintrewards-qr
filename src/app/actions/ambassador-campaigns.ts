"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAmbassadorCampaignWithQrCode } from "@/lib/ambassador/campaigns";
import type { ActionResult } from "./team-members";

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" ? null : s;
  };
  return {
    title: get("title"),
    event_name: get("event_name"),
    event_date: get("event_date"),
    location_name: get("location_name"),
    city: get("city"),
    status: get("status") ?? "draft",
    share_caption: get("share_caption"),
    notes: get("notes"),
  };
}

function validate(v: ReturnType<typeof readForm>): string | null {
  if (!v.title) return "Campaign title is required.";
  return null;
}

/**
 * Creates the campaign AND its QR tracking code in one action, so a campaign can
 * never exist without a code to print or share.
 */
export async function createAmbassadorCampaign(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const values = readForm(formData);
  const invalid = validate(values);
  if (invalid) return { error: invalid };

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  let campaignId: string;
  try {
    const campaign = await createAmbassadorCampaignWithQrCode(
      supabase,
      { ...values, title: values.title! },
      user?.id ?? null,
    );
    campaignId = campaign.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create campaign." };
  }

  revalidatePath("/ambassadors");
  revalidatePath("/dashboard");
  redirect(`/ambassadors/${campaignId}`);
}

/**
 * Updates campaign details only. The tracking code is never regenerated on edit --
 * same reasoning as assignments: it may already be printed or shared.
 */
export async function updateAmbassadorCampaign(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const values = readForm(formData);
  const invalid = validate(values);
  if (invalid) return { error: invalid };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("ambassador_campaigns").update(values).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/ambassadors");
  revalidatePath(`/ambassadors/${id}`);
  redirect(`/ambassadors/${id}`);
}

export async function setAmbassadorCampaignStatus(id: string, status: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("ambassador_campaigns").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/ambassadors");
  revalidatePath(`/ambassadors/${id}`);
  revalidatePath("/dashboard");
  return {};
}
