import { createTeamMember } from "@/app/actions/team-members";
import { PageHeader } from "@/components/common/page-header";
import { TeamMemberForm } from "@/components/common/team-member-form";

export const metadata = { title: "Add Team Member · MintRewards QR" };

export default function NewTeamMemberPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add Team Member" description="Only the name is required." />
      <TeamMemberForm action={createTeamMember} submitLabel="Create Member" />
    </div>
  );
}
