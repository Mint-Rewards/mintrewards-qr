import { createServerSupabase } from "@/lib/supabase/server";
import { csvResponse, stamped, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/**
 * Scan-event export, optionally scoped to one assignment or team member.
 * Joins are done in the select so each row is self-describing in a spreadsheet.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const assignmentId = url.searchParams.get("assignment_id");
  const teamMemberId = url.searchParams.get("team_member_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = supabase
    .from("qr_scan_events")
    .select(
      `scanned_at, platform, device_type, browser, os, ip_address, referrer,
       redirected_to, is_bot,
       team_members ( full_name, city ),
       qr_assignments ( title, reference_code, location_name, location_type, city, status )`,
    )
    .order("scanned_at", { ascending: false })
    .limit(50_000);

  if (assignmentId) query = query.eq("assignment_id", assignmentId);
  if (teamMemberId) query = query.eq("team_member_id", teamMemberId);
  if (from) query = query.gte("scanned_at", from);
  if (to) query = query.lte("scanned_at", to);

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  type Embedded = Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  type Row = Record<string, unknown> & {
    team_members?: Embedded;
    qr_assignments?: Embedded;
  };

  /**
   * PostgREST types a many-to-one embed as an array even though it returns a single
   * object, and the shape differs between client versions. Normalise both cases rather
   * than trusting either.
   */
  const one = (e: Embedded): Record<string, unknown> =>
    Array.isArray(e) ? (e[0] ?? {}) : (e ?? {});

  const rows = ((data ?? []) as unknown as Row[]).map((raw) => {
    const r = raw;
    const member = one(r.team_members);
    const assignment = one(r.qr_assignments);
    return {
      scanned_at: r.scanned_at,
      team_member: member.full_name ?? "",
      assignment: assignment.title ?? "",
      reference_code: assignment.reference_code ?? "",
      location: assignment.location_name ?? "",
      location_type: assignment.location_type ?? "",
      city: assignment.city ?? member.city ?? "",
      assignment_status: assignment.status ?? "",
      platform: r.platform,
      device_type: r.device_type,
      os: r.os,
      browser: r.browser,
      ip_address: r.ip_address,
      referrer: r.referrer,
      redirected_to: r.redirected_to,
      is_bot: r.is_bot,
    };
  });

  const csv = toCsv(rows, [
    { key: "scanned_at", header: "Scanned At" },
    { key: "team_member", header: "Team Member" },
    { key: "assignment", header: "Assignment" },
    { key: "reference_code", header: "Reference Code" },
    { key: "location", header: "Location" },
    { key: "location_type", header: "Location Type" },
    { key: "city", header: "City" },
    { key: "assignment_status", header: "Assignment Status" },
    { key: "platform", header: "Platform" },
    { key: "device_type", header: "Device Type" },
    { key: "os", header: "OS" },
    { key: "browser", header: "Browser" },
    { key: "ip_address", header: "IP Address" },
    { key: "referrer", header: "Referrer" },
    { key: "redirected_to", header: "Redirected To" },
    { key: "is_bot", header: "Bot" },
  ]);

  return csvResponse(csv, stamped("mintrewards-scans"));
}
