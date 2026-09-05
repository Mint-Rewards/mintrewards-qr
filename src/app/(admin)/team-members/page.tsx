import Link from "next/link";
import { Plus, Download } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { TeamMemberPerformance } from "@/lib/types";

export const metadata = { title: "Team Members · MintRewards QR" };
export const dynamic = "force-dynamic";

export default async function TeamMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = await createServerSupabase();

  // Read from the performance view so scan counts appear inline -- the useful number is
  // visible in the list without drilling into each person.
  let query = supabase
    .from("v_team_member_performance")
    .select("*")
    .order("total_scans", { ascending: false });

  if (q) query = query.or(`full_name.ilike.%${q}%,city.ilike.%${q}%,phone.ilike.%${q}%`);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  const members = (data ?? []) as TeamMemberPerformance[];

  return (
    <div>
      <PageHeader
        title="Team Members"
        description="Field onboarding staff and the scans they have generated."
      >
        <Button variant="outline" size="sm" render={<Link href="/api/export/team-members" />}>
          <Download className="size-4" />
          CSV
        </Button>
        <Button size="sm" render={<Link href="/team-members/new" />}>
          <Plus className="size-4" />
          Add Member
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search name, city or phone…" />
        <div className="flex gap-1">
          <FilterLink label="All" active={!status} href="/team-members" />
          <FilterLink label="Active" active={status === "active"} href="/team-members?status=active" />
          <FilterLink label="Inactive" active={status === "inactive"} href="/team-members?status=inactive" />
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error.message}</p>}

      {members.length === 0 ? (
        <EmptyState
          title={q || status ? "No matching team members" : "No team members yet"}
          description={
            q || status
              ? "Try a different search or filter."
              : "Add your first field onboarding team member to get started."
          }
        >
          {!q && !status && (
            <Button size="sm" render={<Link href="/team-members/new" />}>
              <Plus className="size-4" />
              Add Member
            </Button>
          )}
        </EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Assignments</TableHead>
                <TableHead className="text-right">Scans</TableHead>
                <TableHead className="text-right">iOS / Android</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.team_member_id} className="hover:bg-accent/50">
                  <TableCell>
                    <Link
                      href={`/team-members/${m.team_member_id}`}
                      className="font-medium hover:underline"
                    >
                      {m.full_name}
                    </Link>
                    {m.phone && (
                      <div className="text-muted-foreground text-xs">{m.phone}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.city ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={m.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.active_assignments}
                    <span className="text-muted-foreground"> / {m.total_assignments}</span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {m.total_scans}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {m.ios_scans} / {m.android_scans}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      render={<Link href={href} />}
    >
      {label}
    </Button>
  );
}
