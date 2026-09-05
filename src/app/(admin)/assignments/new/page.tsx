import Link from "next/link";
import { createAssignment } from "@/app/actions/assignments";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/page-header";
import { AssignmentForm } from "@/components/common/assignment-form";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";

export const metadata = { title: "New Assignment · MintRewards QR" };
export const dynamic = "force-dynamic";

export default async function NewAssignmentPage() {
  const supabase = await createServerSupabase();
  const { data: members } = await supabase
    .from("team_members")
    .select("id, full_name, city, status")
    .order("status")
    .order("full_name");

  // An assignment must belong to someone, so surface the prerequisite rather than
  // presenting a form with an unfillable required field.
  if (!members || members.length === 0) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="New Assignment" />
        <EmptyState
          title="Add a team member first"
          description="Every assignment must be attributed to a field team member."
        >
          <Button size="sm" render={<Link href="/team-members/new" />}>
            Add Team Member
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New Assignment"
        description="One assignment equals one standee with its own tracking codes."
      />
      <AssignmentForm
        action={createAssignment}
        members={members}
        submitLabel="Create Assignment"
      />
    </div>
  );
}
