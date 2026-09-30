import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Download } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { generateQrDataUrl } from "@/lib/qr";
import { formatDateTime } from "@/lib/format";
import {
  STANDEE_LANGUAGE_LABELS,
  type StandeeLanguage,
} from "@/lib/standee/config";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { CopyButton } from "@/components/common/copy-button";
import { StandeeActions } from "@/components/common/standee-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  labelFor, LOCATION_TYPES,
  type AssignmentPerformance, type QrAssignment, type QrCode, type ScanEvent,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * The workhorse screen: QR previews, tracking URLs, standee generation and scan stats
 * all on one page with no tabs, because this is where the operator spends their time.
 */
export default async function AssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const [
    { data: assignment }, { data: perf }, { data: codes },
    { data: scans }, { data: standees },
  ] = await Promise.all([
    supabase.from("qr_assignments").select("*").eq("id", id).maybeSingle(),
    supabase.from("v_assignment_performance").select("*").eq("assignment_id", id).maybeSingle(),
    supabase.from("qr_codes").select("*").eq("assignment_id", id).order("platform"),
    supabase
      .from("qr_scan_events").select("*").eq("assignment_id", id).eq("is_bot", false)
      .order("scanned_at", { ascending: false }).limit(15),
    supabase
      .from("generated_standees").select("*").eq("assignment_id", id)
      .order("generated_at", { ascending: false }),
  ]);

  if (!assignment) notFound();

  const a = assignment as QrAssignment;
  const p = (perf ?? {}) as Partial<AssignmentPerformance>;
  const qrCodes = (codes ?? []) as QrCode[];
  const events = (scans ?? []) as ScanEvent[];

  const ios = qrCodes.find((c) => c.platform === "ios");
  const android = qrCodes.find((c) => c.platform === "android");

  // standees is ordered newest-first, so the first row per language is that language's
  // most recent generation.
  const seenLanguages = new Set<string>();
  const latestByLanguage = ((standees ?? []) as { language: string; generated_at: string }[])
    .filter((s) => {
      if (seenLanguages.has(s.language)) return false;
      seenLanguages.add(s.language);
      return true;
    });

  // Previews are rendered on demand from the tracking URL -- the same string the printed
  // standee encodes, so what is shown here is exactly what ships.
  const [iosPreview, androidPreview] = await Promise.all([
    ios ? generateQrDataUrl(ios.tracking_url) : null,
    android ? generateQrDataUrl(android.tracking_url) : null,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={a.title}
        description={
          [
            a.location_name,
            a.area,
            a.city,
            a.location_type ? labelFor(LOCATION_TYPES, a.location_type) : null,
          ].filter(Boolean).join(" · ") || undefined
        }
      >
        <Button variant="outline" size="sm" render={<Link href={`/api/export/scans?assignment_id=${a.id}`} />}>
          <Download className="size-4" />
          Export
        </Button>
        <Button size="sm" render={<Link href={`/assignments/${a.id}/edit`} />}>
          <Pencil className="size-4" />
          Edit
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge status={a.status} />
        <span className="text-muted-foreground">
          Ref <span className="text-foreground font-mono">{a.reference_code}</span>
        </span>
        {p.team_member_name && (
          <Link href={`/team-members/${a.team_member_id}`} className="hover:underline">
            {p.team_member_name}
          </Link>
        )}
        {(a.campaign_start_date || a.campaign_end_date) && (
          <span className="text-muted-foreground">
            {a.campaign_start_date ?? "…"} → {a.campaign_end_date ?? "…"}
          </span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total scans" value={p.total_scans} />
        <Stat label="iOS scans" value={p.ios_scans} />
        <Stat label="Android scans" value={p.android_scans} />
        <Stat label="Last 7 days" value={p.scans_last_7d} />
      </div>

      {/* Standee */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Printable standee</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <StandeeActions assignmentId={a.id} hasStandee={(standees ?? []).length > 0} />
          <p className="text-muted-foreground text-xs">
            Generates an English and an Urdu sheet from the same two QR codes, so either
            can be placed in the field and scans attribute identically. Each original
            design is preserved exactly; only the QR placeholders are filled.
          </p>
          {latestByLanguage.length > 0 && (
            <div className="text-muted-foreground space-y-0.5 text-xs">
              {latestByLanguage.map(({ language, generated_at }) => (
                <div key={language}>
                  {STANDEE_LANGUAGE_LABELS[language as StandeeLanguage] ?? language}
                  {" · generated "}
                  {formatDateTime(generated_at)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR codes */}
      <div className="grid gap-4 md:grid-cols-2">
        <QrPanel title="iPhone" platform="ios" code={ios} preview={iosPreview} />
        <QrPanel title="Android" platform="android" code={android} preview={androidPreview} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent scans</CardTitle></CardHeader>
        <CardContent className="p-0">
          {events.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center text-sm">
              No scans yet. Scan a QR code above to test the tracking.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>Browser</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(e.scanned_at)}
                    </TableCell>
                    <TableCell className="capitalize">{e.platform}</TableCell>
                    <TableCell className="text-muted-foreground">{e.device_type ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.os ?? "—"}
                      {/* A mismatch means someone scanned the wrong card -- useful
                          signal about how the standee reads in the field. */}
                      {e.os && e.os !== e.platform && (e.os === "ios" || e.os === "android") && (
                        <span className="ml-1 text-amber-600" title="Scanned the other platform's QR code">
                          ⚠
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.browser ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {a.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm whitespace-pre-wrap">{a.notes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}

function QrPanel({
  title, platform, code, preview,
}: {
  title: string;
  platform: "ios" | "android";
  code?: QrCode;
  preview: string | null;
}) {
  if (!code || !preview) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">
            No {platform} QR code exists for this assignment.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={`${title} QR code`}
            className="size-32 shrink-0 rounded-md border bg-white p-1"
          />
          <div className="min-w-0 space-y-2">
            <div>
              <div className="text-muted-foreground text-xs">Tracking code</div>
              <div className="font-mono text-sm">{code.tracking_code}</div>
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground text-xs">Tracking URL</div>
              <div className="truncate font-mono text-xs" title={code.tracking_url}>
                {code.tracking_url}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={code.tracking_url} label="Copy URL" />
          {/* A plain <a>, deliberately NOT next/link. The tracking URL is same-origin,
              so next/link would treat it as an app route and prefetch it on render --
              silently logging a scan every time this page loads. */}
          <Button
            variant="outline"
            size="sm"
            render={<a href={code.tracking_url} target="_blank" rel="noopener noreferrer" />}
          >
            Test scan
          </Button>
        </div>
        <p className="text-muted-foreground truncate text-xs" title={code.destination_url}>
          Redirects to {code.destination_url}
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-sm">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value ?? 0}</div>
      </CardContent>
    </Card>
  );
}
