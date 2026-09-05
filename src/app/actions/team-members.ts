"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Team member mutations.
 *
 * These run through the session-scoped client, not the service role, so RLS applies and
 * an unauthenticated caller cannot write even if it reaches the action directly.
 */

export interface ActionResult {
  error?: string;
}

function readForm(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" ? null : s;
  };
  return {
    full_name: get("full_name"),
    phone: get("phone"),
    email: get("email"),
    city: get("city"),
    region: get("region"),
    status: get("status") ?? "active",
    notes: get("notes"),
  };
}

export async function createTeamMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const values = readForm(formData);
  if (!values.full_name) return { error: "Full name is required." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("team_members")
    .insert(values)
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/team-members");
  revalidatePath("/dashboard");
  redirect(`/team-members/${data.id}`);
}

export async function updateTeamMember(
  id: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const values = readForm(formData);
  if (!values.full_name) return { error: "Full name is required." };

  const supabase = await createServerSupabase();
  const { error } = await supabase.from("team_members").update(values).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/team-members");
  revalidatePath(`/team-members/${id}`);
  redirect(`/team-members/${id}`);
}

/**
 * Deactivate rather than delete.
 *
 * A team member with assignments is protected by ON DELETE RESTRICT, and deleting one
 * would orphan the scan history that makes past campaigns attributable. Setting the
 * status preserves the record and removes them from active workflows.
 */
export async function setTeamMemberStatus(id: string, status: "active" | "inactive") {
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("team_members").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/team-members");
  revalidatePath(`/team-members/${id}`);
  revalidatePath("/dashboard");
  return {};
}
