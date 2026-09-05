import { notFound } from "next/navigation";
import { updateAssignment } from "@/app/actions/assignments";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/page-header";
import { AssignmentForm } from "@/components/common/assignment-form";
import type { QrAssignment } from "@/lib/types";

export const metadata = { title: "Edit Assignment · MintRewards QR" };
export const dynamic = "force-dynamic";

export default async function EditAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const [{ data: assignment }, { data: members }] = await Promise.all([
    supabase.from("qr_assignments").select("*").eq("id", id).maybeSingle(),
    supabase.from("team_members").select("id, full_name, city, status").order("full_name"),
  ]);

  if (!assignment) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader title="Edit Assignment" description={(assignment as QrAssignment).title} />
      <AssignmentForm
        action={updateAssignment.bind(null, id)}
        members={members ?? []}
        assignment={assignment as QrAssignment}
        submitLabel="Save Changes"
      />
    </div>
  );
}
