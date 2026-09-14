import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Download } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { buildAmbassadorUrl } from "@/lib/env";
import { generateQrDataUrl } from "@/lib/qr";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { CopyButton } from "@/components/common/copy-button";
import { CampaignStatusActions } from "@/components/common/campaign-status-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AMBASSADOR_STATUS_LABELS } from "@/lib/ambassador/config";
import type {
  AmbassadorCampaign, AmbassadorCampaignPerformance, MintAmbassador,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AmbassadorCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const [{ data: campaign }, { data: perf }, { data: roster }] = await Promise.all([
    supabase.from("ambassador_campaigns").select("*").eq("id", id).maybeSingle(),
    supabase.from("v_ambassador_campaign_performance").select("*").eq("campaign_id", id).maybeSingle(),
    supabase
      .from("mint_ambassadors").select("*").eq("campaign_id", id)
      .order("created_at", { ascending: false }).limit(50),
  ]);

  if (!campaign) notFound();

  const c = campaign as AmbassadorCampaign;
  const p = (perf ?? {}) as Partial<AmbassadorCampaignPerformance>;
  const ambassadors = (roster ?? []) as MintAmbassador[];

  /**
   * The QR is built from the tracking CODE plus the CURRENT environment's base URL,
   * not from the stored tracking_url.
   *
   * tracking_url records the domain in force when the campaign was created, so a
   * campaign created against a dev server keeps `http://localhost:3000` forever and
   * its QR is dead everywhere else. The code is the permanent identifier; the URL is
   * just how it is addressed, so deriving it here means the QR always points at
   * whatever domain is actually serving this page.
   */
  const trackingUrl = buildAmbassadorUrl(c.tracking_code);

  // Only worth flagging on a real deployment. Viewing a production campaign from a dev
  // server always "differs", and warning about that every time would be pure noise.
  const isLocalHost = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(trackingUrl);
  const staleStoredUrl = !isLocalHost && c.tracking_url !== trackingUrl;

  const qrPreview = await generateQrDataUrl(trackingUrl);

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.title}
        description={[c.event_name, c.location_name, c.city].filter(Boolean).join(" · ") || undefined}
      >
        <Button
          variant="outline" size="sm"
          render={<Link href={`/api/export/ambassadors?campaign_id=${c.id}`} />}
        >
          <Download className="size-4" />
          Export
        </Button>
        <Button size="sm" render={<Link href={`/ambassadors/${c.id}/edit`} />}>
          <Pencil className="size-4" />
          Edit
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge status={c.status} />
        <span className="text-muted-foreground">
          Ref <span className="text-foreground font-mono">{c.reference_code}</span>
        </span>
        {c.event_date && <span className="text-muted-foreground">{c.event_date}</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Form views" value={p.total_views} />
        <Stat label="Registrations" value={p.total_registrations} />
        <Stat label="Students" value={p.student_count} />
        <Stat label="Alumni" value={p.alumnus_count} />
        <Stat label="Conversion" value={p.conversion_pct ?? undefined} suffix="%" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Registration QR code</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrPreview}
              alt="Ambassador registration QR code"
              className="size-32 shrink-0 rounded-md border bg-white p-1"
            />
            <div className="min-w-0 space-y-2">
              <div>
                <div className="text-muted-foreground text-xs">Tracking code</div>
                <div className="font-mono text-sm">{c.tracking_code}</div>
              </div>
              <div className="min-w-0">
                <div className="text-muted-foreground text-xs">Tracking URL</div>
                <div className="truncate font-mono text-xs" title={trackingUrl}>
                  {trackingUrl}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={trackingUrl} label="Copy URL" />
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/api/ambassadors/${c.id}/qr`} />}
                >
                  <Download className="size-4" />
                  QR as SVG
                </Button>
                <Button variant="outline" size="sm" render={<Link href={trackingUrl} target="_blank" />}>
                  Open form
                </Button>
                <CampaignStatusActions campaignId={c.id} status={c.status} />
              </div>
              <p className="text-muted-foreground text-xs">
                SVG is vector — hand it to a designer and it stays sharp at any size, from
                a sticker to a banner.
              </p>
            </div>
          </div>
          {isLocalHost && (
            <p className="text-muted-foreground text-xs">
              You are viewing this from a local server, so the QR above encodes a
              <span className="font-mono"> localhost </span> address for testing. Open this
              campaign on the deployed site to get the QR that is safe to share or print.
            </p>
          )}
          {staleStoredUrl && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                This campaign was created under a different domain
                (<span className="font-mono">{c.tracking_url}</span>). The QR above uses the
                current one and works — but any copy shared or printed earlier points at the
                old address and is dead.
              </p>
            </div>
          )}
          {c.status !== "active" && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>This campaign is {c.status}, so its QR code does not work yet.</strong>{" "}
                Anyone opening the link above sees “This link isn&apos;t active”. Activate it
                before printing or sharing the code.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Registered ambassadors</CardTitle></CardHeader>
        <CardContent className="p-0">
          {ambassadors.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              No registrations yet. Scan the QR code above to test the form.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>University</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ambassadors.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{a.university}</TableCell>
                    <TableCell className="text-muted-foreground">{a.batch_year}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {AMBASSADOR_STATUS_LABELS[a.ambassador_status]}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(a.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {c.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{c.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value?: number; suffix?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-sm">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {value ?? 0}{value !== undefined && suffix}
        </div>
      </CardContent>
    </Card>
  );
}
