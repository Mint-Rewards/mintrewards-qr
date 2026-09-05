import Link from "next/link";
import { QrCode, ScanLine, Apple, Smartphone } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Dashboard · MintRewards QR" };
export const dynamic = "force-dynamic";

interface Totals {
  active_team_members: number;
  total_assignments: number;
  active_assignments: number;
  total_scans: number;
  ios_scans: number;
  android_scans: number;
  scans_last_7d: number;
  scans_today: number;
}

export default async function DashboardPage() {
  const supabase = await createServerSupabase();

  // Aggregation happens in SQL (see 0003_views.sql) rather than being reassembled here
  // across several round trips.
  const [{ data: totals }, { data: topMembers }, { data: topAssignments }] =
    await Promise.all([
      supabase.from("v_dashboard_totals").select("*").maybeSingle(),
      supabase
        .from("v_team_member_performance")
        .select("team_member_id, full_name, city, total_scans, active_assignments")
        .order("total_scans", { ascending: false })
        .limit(5),
      supabase
        .from("v_assignment_performance")
        .select("assignment_id, title, location_name, city, total_scans, team_member_name")
        .order("total_scans", { ascending: false })
        .limit(5),
    ]);

  const t = (totals ?? {}) as Partial<Totals>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Scan attribution across the field onboarding team.
        </p>
      </header>

      {/* Headline numbers first: the question is almost always "how are we doing today". */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total scans" value={t.total_scans} icon={ScanLine}
              sub={`${t.scans_today ?? 0} today · ${t.scans_last_7d ?? 0} last 7 days`} />
        <Stat label="iOS scans" value={t.ios_scans} icon={Apple}
              sub={sharePct(t.ios_scans, t.total_scans)} />
        <Stat label="Android scans" value={t.android_scans} icon={Smartphone}
              sub={sharePct(t.android_scans, t.total_scans)} />
        <Stat label="Active assignments" value={t.active_assignments} icon={QrCode}
              sub={`${t.total_assignments ?? 0} total`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Top team members</CardTitle>
            <Link href="/team-members" className="text-muted-foreground hover:text-foreground text-xs">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {(topMembers ?? []).length === 0 ? (
              <Empty>No team members yet.</Empty>
            ) : (
              topMembers!.map((m) => (
                <Row
                  key={m.team_member_id}
                  href={`/team-members/${m.team_member_id}`}
                  title={m.full_name}
                  sub={[m.city, `${m.active_assignments} active`].filter(Boolean).join(" · ")}
                  value={m.total_scans}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Top locations</CardTitle>
            <Link href="/assignments" className="text-muted-foreground hover:text-foreground text-xs">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {(topAssignments ?? []).length === 0 ? (
              <Empty>No assignments yet.</Empty>
            ) : (
              topAssignments!.map((a) => (
                <Row
                  key={a.assignment_id}
                  href={`/assignments/${a.assignment_id}`}
                  title={a.title}
                  sub={[a.location_name, a.city, a.team_member_name].filter(Boolean).join(" · ")}
                  value={a.total_scans}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function sharePct(part?: number, total?: number): string {
  if (!total || !part) return "—";
  return `${Math.round((part / total) * 100)}% of scans`;
}

function Stat({
  label, value, sub, icon: Icon,
}: {
  label: string;
  value?: number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">{label}</span>
          <Icon className="text-muted-foreground size-4" />
        </div>
        <div className="mt-2 text-3xl font-semibold tabular-nums">{value ?? 0}</div>
        {sub && <div className="text-muted-foreground mt-1 text-xs">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Row({ href, title, sub, value }: {
  href: string; title: string; sub?: string; value: number;
}) {
  return (
    <Link
      href={href}
      className="hover:bg-accent -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        {sub && <div className="text-muted-foreground truncate text-xs">{sub}</div>}
      </div>
      <Badge variant="secondary" className="tabular-nums">{value}</Badge>
    </Link>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-6 text-center text-sm">{children}</p>;
}
