import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Download } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { MemberStatusToggle } from "@/components/common/member-status-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type {
  AssignmentPerformance, ScanEvent, TeamMember, TeamMemberPerformance,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const [{ data: member }, { data: perf }, { data: assignments }, { data: scans }] =
    await Promise.all([
      supabase.from("team_members").select("*").eq("id", id).maybeSingle(),
      supabase.from("v_team_member_performance").select("*").eq("team_member_id", id).maybeSingle(),
      supabase
        .from("v_assignment_performance")
        .select("*")
        .eq("team_member_id", id)
        .order("total_scans", { ascending: false }),
      supabase
        .from("qr_scan_events")
        .select("*")
        .eq("team_member_id", id)
        .eq("is_bot", false)
        .order("scanned_at", { ascending: false })
        .limit(15),
    ]);

  if (!member) notFound();

  const m = member as TeamMember;
  const p = (perf ?? {}) as Partial<TeamMemberPerformance>;
  const rows = (assignments ?? []) as AssignmentPerformance[];
  const events = (scans ?? []) as ScanEvent[];

  return (
    <div className="space-y-6">
      <PageHeader
        title={m.full_name}
        description={[m.city, m.region, m.phone, m.email].filter(Boolean).join(" · ") || undefined}
      >
        <MemberStatusToggle id={m.id} status={m.status} />
        <Button
          variant="outline"
          size="sm"
          render={<Link href={`/api/export/scans?team_member_id=${m.id}`} />}
        >
          <Download className="size-4" />
          Export
        </Button>
        <Button size="sm" render={<Link href={`/team-members/${m.id}/edit`} />}>
          <Pencil className="size-4" />
          Edit
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={m.status} />
        {m.notes && <span className="text-muted-foreground text-sm">{m.notes}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total scans" value={p.total_scans} />
        <Stat label="iOS" value={p.ios_scans} />
        <Stat label="Android" value={p.android_scans} />
        <Stat label="Last 7 days" value={p.scans_last_7d} />
        <Stat
          label="Assignments"
          value={p.active_assignments}
          sub={`${p.total_assignments ?? 0} total`}
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Scans by assignment</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No assignments yet"
                description="Create an assignment to generate QR codes for this member."
              >
                <Button size="sm" render={<Link href="/assignments/new" />}>
                  New Assignment
                </Button>
              </EmptyState>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">iOS</TableHead>
                  <TableHead className="text-right">Android</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.assignment_id} className="hover:bg-accent/50">
                    <TableCell>
                      <Link href={`/assignments/${a.assignment_id}`} className="font-medium hover:underline">
                        {a.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[a.location_name, a.city].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{a.ios_scans}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.android_scans}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{a.total_scans}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">No scans recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>OS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(e.scanned_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="capitalize">{e.platform}</TableCell>
                    <TableCell className="text-muted-foreground">{e.device_type ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.os ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value?: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-sm">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value ?? 0}</div>
        {sub && <div className="text-muted-foreground mt-1 text-xs">{sub}</div>}
      </CardContent>
    </Card>
  );
}
