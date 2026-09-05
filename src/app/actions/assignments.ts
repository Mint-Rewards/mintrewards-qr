"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAssignmentWithQrCodes } from "@/lib/assignments";
import type { ActionResult } from "./team-members";

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" ? null : s;
  };
  return {
    team_member_id: get("team_member_id"),
    title: get("title"),
    location_name: get("location_name"),
    location_type: get("location_type"),
    city: get("city"),
    area: get("area"),
    campaign_start_date: get("campaign_start_date"),
    campaign_end_date: get("campaign_end_date"),
    status: get("status") ?? "draft",
    notes: get("notes"),
  };
}

function validate(v: ReturnType<typeof readForm>): string | null {
  if (!v.team_member_id) return "Select a team member.";
  if (!v.title) return "Assignment title is required.";
  if (
    v.campaign_start_date &&
    v.campaign_end_date &&
    v.campaign_end_date < v.campaign_start_date
  ) {
    // Also enforced by a CHECK constraint; caught here for a friendlier message.
    return "Campaign end date cannot be before the start date.";
  }
  return null;
}

/**
 * Creates the assignment AND its two QR codes in one action, so an assignment can never
 * exist without the codes needed to generate a standee.
 */
export async function createAssignment(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const values = readForm(formData);
  const invalid = validate(values);
  if (invalid) return { error: invalid };

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  let assignmentId: string;
  try {
    const { assignment } = await createAssignmentWithQrCodes(
      supabase,
      {
        team_member_id: values.team_member_id!,
        title: values.title!,
        location_name: values.location_name,
        location_type: values.location_type,
        city: values.city,
        area: values.area,
        campaign_start_date: values.campaign_start_date,
        campaign_end_date: values.campaign_end_date,
        status: values.status,
        notes: values.notes,
      },
      user?.id ?? null,
    );
    assignmentId = assignment.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to create assignment." };
  }

  revalidatePath("/assignments");
  revalidatePath("/dashboard");
  redirect(`/assignments/${assignmentId}`);
}

/**
 * Updates assignment details only.
 *
 * Tracking codes are deliberately never regenerated on edit: they are printed on
 * physical standees already in the field, so changing one would silently kill every
 * standee bearing it. Reassigning to a different team member is allowed and cascades to
 * the QR codes via trigger, so future scans attribute correctly.
 */
export async function updateAssignment(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const values = readForm(formData);
  const invalid = validate(values);
  if (invalid) return { error: invalid };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("qr_assignments").update(values).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/assignments");
  revalidatePath(`/assignments/${id}`);
  redirect(`/assignments/${id}`);
}

export async function setAssignmentStatus(id: string, status: string) {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("qr_assignments").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/assignments");
  revalidatePath(`/assignments/${id}`);
  revalidatePath("/dashboard");
  return {};
}
