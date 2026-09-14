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
import { AMBASSADOR_CAMPAIGN_STATUSES, type AmbassadorCampaignPerformance } from "@/lib/types";

export const metadata = { title: "Mint Ambassadors · MintRewards QR" };
export const dynamic = "force-dynamic";

export default async function AmbassadorCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = await createServerSupabase();

  let query = supabase
    .from("v_ambassador_campaign_performance")
    .select("*")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(
      `title.ilike.%${q}%,event_name.ilike.%${q}%,location_name.ilike.%${q}%,city.ilike.%${q}%,reference_code.ilike.%${q}%`,
    );
  }
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  const rows = (data ?? []) as AmbassadorCampaignPerformance[];

  return (
    <div>
      <PageHeader
        title="Mint Ambassadors"
        description="Each campaign is one QR code that opens a public sign-up form for the student ambassador program."
      >
        <Button variant="outline" size="sm" render={<Link href="/api/export/ambassadors" />}>
          <Download className="size-4" />
          CSV
        </Button>
        <Button size="sm" render={<Link href="/ambassadors/new" />}>
          <Plus className="size-4" />
          New Campaign
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search title, event, location, city or ref…" />
        <div className="flex flex-wrap gap-1">
          <Button
            variant={!status ? "secondary" : "ghost"}
            size="sm"
            render={<Link href="/ambassadors" />}
          >
            All
          </Button>
          {AMBASSADOR_CAMPAIGN_STATUSES.map((s) => (
            <Button
              key={s.value}
              variant={status === s.value ? "secondary" : "ghost"}
              size="sm"
              render={<Link href={`/ambassadors?status=${s.value}`} />}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error.message}</p>}

      {rows.length === 0 ? (
        <EmptyState
          title={q || status ? "No matching campaigns" : "No ambassador campaigns yet"}
          description={
            q || status
              ? "Try a different search or filter."
              : "Create a campaign to mint its QR code and start collecting sign-ups."
          }
        >
          {!q && !status && (
            <Button size="sm" render={<Link href="/ambassadors/new" />}>
              <Plus className="size-4" />
              New Campaign
            </Button>
          )}
        </EmptyState>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Registrations</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.campaign_id} className="hover:bg-accent/50">
                  <TableCell>
                    <Link href={`/ambassadors/${c.campaign_id}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                    <div className="text-muted-foreground font-mono text-xs">
                      {c.reference_code}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[c.location_name, c.city].filter(Boolean).join(", ") || "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{c.total_views}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {c.total_registrations}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.conversion_pct === null ? "—" : `${c.conversion_pct}%`}
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
