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
import { ASSIGNMENT_STATUSES, labelFor, LOCATION_TYPES, type AssignmentPerformance } from "@/lib/types";

export const metadata = { title: "Assignments · MintRewards QR" };
export const dynamic = "force-dynamic";

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; city?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = await createServerSupabase();

  let query = supabase
    .from("v_assignment_performance")
    .select("*")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(
      `title.ilike.%${q}%,location_name.ilike.%${q}%,city.ilike.%${q}%,reference_code.ilike.%${q}%`,
    );
  }
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  const rows = (data ?? []) as AssignmentPerformance[];

  return (
    <div>
      <PageHeader
        title="Assignments"
        description="Each assignment is one standee with its own iOS and Android QR codes."
      >
        <Button variant="outline" size="sm" render={<Link href="/api/export/assignments" />}>
          <Download className="size-4" />
          CSV
        </Button>
        <Button size="sm" render={<Link href="/assignments/new" />}>
          <Plus className="size-4" />
          New Assignment
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search title, location, city or ref…" />
        <div className="flex flex-wrap gap-1">
          <Button
            variant={!status ? "secondary" : "ghost"}
            size="sm"
            render={<Link href="/assignments" />}
          >
            All
          </Button>
          {ASSIGNMENT_STATUSES.map((s) => (
            <Button
              key={s.value}
              variant={status === s.value ? "secondary" : "ghost"}
              size="sm"
              render={<Link href={`/assignments?status=${s.value}`} />}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error.message}</p>}

      {rows.length === 0 ? (
        <EmptyState
          title={q || status ? "No matching assignments" : "No assignments yet"}
          description={
            q || status
              ? "Try a different search or filter."
              : "Create an assignment to mint its iOS and Android QR codes."
          }
        >
          {!q && !status && (
            <Button size="sm" render={<Link href="/assignments/new" />}>
              <Plus className="size-4" />
              New Assignment
            </Button>
          )}
        </EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assignment</TableHead>
                <TableHead>Team Member</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">iOS</TableHead>
                <TableHead className="text-right">Android</TableHead>
                <TableHead className="text-right">Scans</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.assignment_id} className="hover:bg-accent/50">
                  <TableCell>
                    <Link href={`/assignments/${a.assignment_id}`} className="font-medium hover:underline">
                      {a.title}
                    </Link>
                    <div className="text-muted-foreground font-mono text-xs">
                      {a.reference_code}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/team-members/${a.team_member_id}`}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {a.team_member_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[a.location_name, a.city].filter(Boolean).join(", ") || "—"}
                    {a.location_type && (
                      <div className="text-xs">{labelFor(LOCATION_TYPES, a.location_type)}</div>
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={a.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{a.ios_scans}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.android_scans}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{a.total_scans}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
