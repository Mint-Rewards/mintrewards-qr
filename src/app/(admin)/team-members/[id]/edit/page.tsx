import { notFound } from "next/navigation";
import { updateTeamMember } from "@/app/actions/team-members";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/page-header";
import { TeamMemberForm } from "@/components/common/team-member-form";
import type { TeamMember } from "@/lib/types";

export const metadata = { title: "Edit Team Member · MintRewards QR" };
export const dynamic = "force-dynamic";

export default async function EditTeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("team_members").select("*").eq("id", id).maybeSingle();

  if (!data) notFound();
  const member = data as TeamMember;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Edit Team Member" description={member.full_name} />
      <TeamMemberForm
        action={updateTeamMember.bind(null, id)}
        member={member}
        submitLabel="Save Changes"
      />
    </div>
  );
}
