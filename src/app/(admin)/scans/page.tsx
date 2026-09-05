import Link from "next/link";
import { Download } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Scan Events · MintRewards QR" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

/**
 * Raw scan log.
 *
 * Unlike the dashboard views, this shows bot traffic too (behind a toggle) so the
 * numbers stay auditable -- an operator can see exactly what was excluded and why.
 */
export default async function ScansPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string; bots?: string; page?: string }>;
}) {
  const { platform, bots, page } = await searchParams;
  const pageNum = Math.max(1, Number(page ?? 1) || 1);
  const supabase = await createServerSupabase();

  let query = supabase
    .from("qr_scan_events")
    .select(
      `id, scanned_at, platform, device_type, browser, os, is_bot, ip_address,
       team_members ( id, full_name ),
       qr_assignments ( id, title, location_name, city )`,
      { count: "exact" },
    )
    .order("scanned_at", { ascending: false })
    .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1);

  if (platform) query = query.eq("platform", platform);
  if (bots !== "1") query = query.eq("is_bot", false);

  const { data, count, error } = await query;

  type Row = {
    id: string; scanned_at: string; platform: string;
    device_type: string | null; browser: string | null; os: string | null;
    is_bot: boolean; ip_address: string | null;
    team_members: { id: string; full_name: string } | null;
    qr_assignments: { id: string; title: string; location_name: string | null; city: string | null } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { platform, bots, page: String(pageNum), ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/scans?${p}`;
  };

  return (
    <div>
      <PageHeader title="Scan Events" description={`${count ?? 0} recorded scans.`}>
        <Button variant="outline" size="sm" render={<Link href="/api/export/scans" />}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-1">
        <Button variant={!platform ? "secondary" : "ghost"} size="sm" render={<Link href={qs({ platform: undefined, page: "1" })} />}>
          All platforms
        </Button>
        <Button variant={platform === "ios" ? "secondary" : "ghost"} size="sm" render={<Link href={qs({ platform: "ios", page: "1" })} />}>
          iOS
        </Button>
        <Button variant={platform === "android" ? "secondary" : "ghost"} size="sm" render={<Link href={qs({ platform: "android", page: "1" })} />}>
          Android
        </Button>
        <span className="text-muted-foreground mx-2">·</span>
        <Button variant={bots === "1" ? "secondary" : "ghost"} size="sm" render={<Link href={qs({ bots: bots === "1" ? undefined : "1", page: "1" })} />}>
          {bots === "1" ? "Hiding nothing" : "Show bot traffic"}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error.message}</p>}

      {rows.length === 0 ? (
        <EmptyState
          title="No scan events yet"
          description="Scans appear here as soon as someone scans a standee QR code."
        />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>OS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => (
                  <TableRow key={e.id} className={e.is_bot ? "opacity-60" : undefined}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(e.scanned_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {e.team_members ? (
                        <Link href={`/team-members/${e.team_members.id}`} className="hover:underline">
                          {e.team_members.full_name}
                        </Link>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {e.qr_assignments ? (
                        <Link href={`/assignments/${e.qr_assignments.id}`} className="hover:underline">
                          {e.qr_assignments.title}
                        </Link>
                      ) : "—"}
                      {e.qr_assignments?.city && (
                        <div className="text-muted-foreground text-xs">{e.qr_assignments.city}</div>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">
                      {e.platform}
                      {e.is_bot && <Badge variant="secondary" className="ml-2">bot</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.device_type ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.os ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-muted-foreground text-sm">
                Page {pageNum} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm" disabled={pageNum <= 1}
                  render={<Link href={qs({ page: String(pageNum - 1) })} />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline" size="sm" disabled={pageNum >= totalPages}
                  render={<Link href={qs({ page: String(pageNum + 1) })} />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
