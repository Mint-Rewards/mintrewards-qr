import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * End-to-end attribution test against the real Supabase project.
 *
 * This is the automated form of the spec's manual verification checklist: create a team
 * member, create an assignment, confirm two unique tracking codes are minted, scan both
 * QR URLs, and confirm the scan events land attributed to the right person, assignment
 * and platform.
 *
 * Skips (rather than fails) when Supabase credentials are absent, so the unit suite
 * still runs in a bare checkout or CI without secrets.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.QR_PUBLIC_BASE_URL ?? "http://localhost:3000";

const configured =
  !!URL_ && !!SERVICE && !!ANON && !URL_.includes("placeholder");

const d = configured ? describe : describe.skip;

d("attribution end-to-end", () => {
  let admin: SupabaseClient;
  let teamMemberId: string;
  let assignmentId: string;
  const created: string[] = [];

  beforeAll(() => {
    admin = createClient(URL_!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterAll(async () => {
    // qr_codes / qr_scan_events cascade from the assignment.
    if (assignmentId) await admin.from("qr_assignments").delete().eq("id", assignmentId);
    if (teamMemberId) await admin.from("team_members").delete().eq("id", teamMemberId);
    for (const id of created) await admin.from("team_members").delete().eq("id", id);
  });

  it("creates a team member", async () => {
    const { data, error } = await admin
      .from("team_members")
      .insert({
        full_name: "Test Field Agent",
        phone: "+92 300 0000000",
        city: "Lahore",
        status: "active",
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.id).toBeTruthy();
    expect(data!.status).toBe("active");
    teamMemberId = data!.id;
  });

  it("creates an assignment with exactly two unique QR codes", async () => {
    const { createAssignmentWithQrCodes } = await import("@/lib/assignments");

    const result = await createAssignmentWithQrCodes(
      admin,
      {
        team_member_id: teamMemberId,
        title: "DHA Phase 5 Flats — Gate 2",
        location_name: "DHA Phase 5",
        location_type: "flats",
        city: "Lahore",
        status: "active",
      },
      null,
    );

    assignmentId = result.assignment.id;

    expect(result.assignment.reference_code).toMatch(/^MR-/);
    expect(result.qrCodes).toHaveLength(2);

    const platforms = result.qrCodes.map((c) => c.platform).sort();
    expect(platforms).toEqual(["android", "ios"]);

    // Distinct, non-guessable codes -- never a database id.
    const [a, b] = result.qrCodes;
    expect(a.tracking_code).not.toBe(b.tracking_code);
    expect(a.tracking_code).not.toBe(a.id);

    for (const code of result.qrCodes) {
      expect(code.tracking_url).toContain(`/r/${code.platform}/${code.tracking_code}`);
      expect(code.team_member_id).toBe(teamMemberId);
      // Destination is resolved per-platform at creation time.
      if (code.platform === "ios") expect(code.destination_url).toContain("apps.apple.com");
      else expect(code.destination_url).toContain("play.google.com");
    }
  });

  it("rejects a second QR code for the same platform", async () => {
    // The UNIQUE (assignment_id, platform) constraint is what guarantees an assignment
    // always has exactly one iOS and one Android code.
    const { error } = await admin.from("qr_codes").insert({
      assignment_id: assignmentId,
      team_member_id: teamMemberId,
      platform: "ios",
      tracking_code: "DUPLICATE123",
      tracking_url: "x",
      destination_url: "x",
    });
    expect(error?.code).toBe("23505");
  });

  it("records an attributed scan and redirects to the right store", async () => {
    const reachable = await fetch(`${APP}/login`).then((r) => r.ok).catch(() => false);
    if (!reachable) {
      console.warn(`SKIPPED redirect assertions: no dev server at ${APP}`);
      return;
    }

    const { data: codes } = await admin
      .from("qr_codes")
      .select("*")
      .eq("assignment_id", assignmentId);

    for (const code of codes!) {
      const res = await fetch(code.tracking_url, {
        redirect: "manual",
        headers: {
          "user-agent":
            code.platform === "ios"
              ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1"
              : "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125.0.0.0 Mobile Safari/537.36",
        },
      });

      expect(res.status).toBe(302);
      const location = res.headers.get("location")!;
      // The QR's own platform decides the destination -- never the user agent.
      if (code.platform === "ios") expect(location).toContain("apps.apple.com");
      else expect(location).toContain("play.google.com");

      // A cached redirect would be a silently lost scan event.
      expect(res.headers.get("cache-control")).toContain("no-store");
    }

    // Logging happens in after(), so allow the response to settle.
    await new Promise((r) => setTimeout(r, 2500));

    const { data: events } = await admin
      .from("qr_scan_events")
      .select("*")
      .eq("assignment_id", assignmentId);

    expect(events!.length).toBeGreaterThanOrEqual(2);

    // Every event must be attributed to the right person and assignment.
    for (const e of events!) {
      expect(e.team_member_id).toBe(teamMemberId);
      expect(e.assignment_id).toBe(assignmentId);
      expect(e.is_bot).toBe(false);
      expect(["ios", "android"]).toContain(e.platform);
    }
    expect(events!.some((e) => e.platform === "ios")).toBe(true);
    expect(events!.some((e) => e.platform === "android")).toBe(true);

    // The OS is recorded independently of the QR platform, which is what makes
    // "scanned the Android code on an iPhone" visible later.
    const iosEvent = events!.find((e) => e.platform === "ios")!;
    expect(iosEvent.os).toBe("ios");
    expect(iosEvent.device_type).toBe("mobile");
  });

  it("sends an unknown tracking code to the fallback, not an error", async () => {
    const reachable = await fetch(`${APP}/login`).then((r) => r.ok).catch(() => false);
    if (!reachable) return;

    const res = await fetch(`${APP}/r/ios/ZZZZZZZZZZZZ`, { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(process.env.QR_FALLBACK_URL!);
  });

  it("aggregates scans into the dashboard views", async () => {
    const { data: perf } = await admin
      .from("v_assignment_performance")
      .select("*")
      .eq("assignment_id", assignmentId)
      .single();

    expect(perf).toBeTruthy();
    expect(Number(perf!.total_scans)).toBeGreaterThanOrEqual(2);
    expect(Number(perf!.ios_scans)).toBeGreaterThanOrEqual(1);
    expect(Number(perf!.android_scans)).toBeGreaterThanOrEqual(1);
    expect(perf!.team_member_name).toBe("Test Field Agent");
  });

  it("blocks anonymous reads via RLS", async () => {
    // The anon key ships in the browser bundle; RLS is what actually protects the data.
    const anon = createClient(URL_!, ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await anon.from("team_members").select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("blocks anonymous scan-event forgery", async () => {
    // qr_scan_events deliberately has no client insert policy, so a leaked anon key
    // cannot poison attribution numbers.
    const anon = createClient(URL_!, ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon.from("qr_scan_events").insert({
      qr_code_id: "00000000-0000-0000-0000-000000000000",
      assignment_id: assignmentId,
      team_member_id: teamMemberId,
      platform: "ios",
    });
    expect(error).not.toBeNull();
  });
});
