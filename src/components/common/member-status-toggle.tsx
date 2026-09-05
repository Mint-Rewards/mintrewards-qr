"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCheck, UserX } from "lucide-react";
import { setTeamMemberStatus } from "@/app/actions/team-members";
import { Button } from "@/components/ui/button";

/**
 * Deactivate, never delete -- a member's scan history is what makes past campaigns
 * attributable, and the FK is ON DELETE RESTRICT for exactly that reason.
 */
export function MemberStatusToggle({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = status === "active" ? "inactive" : "active";

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setTeamMemberStatus(id, next);
          router.refresh();
        })
      }
    >
      {next === "inactive" ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
      {next === "inactive" ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
