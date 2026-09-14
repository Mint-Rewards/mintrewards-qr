import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateTrackingCode, generateReferenceCode } from "@/lib/tracking-code";

/**
 * The two QR systems must never bleed into each other.
 *
 * A printed field-team standee must ALWAYS send the scanner to an app store, and an
 * ambassador QR must ALWAYS open the sign-up form -- regardless of what else exists in
 * the database. Both systems mint codes from the same generator into separate tables
 * with separate unique constraints, so the same 12-character string CAN legitimately
 * exist in both at once.
 *
 * This test forces exactly that collision and proves behaviour is still decided by the
 * URL namespace the QR encodes (`/r/[platform]/` vs `/a/`), never by the code. It also
 * covers the two "wrong door" cases, where a code from one system is presented to the
 * other's route and must fail safe rather than cross over.
 *
 * Skips (rather than fails) without Supabase credentials or a running dev server.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.QR_PUBLIC_BASE_URL ?? "http://localhost:3000";

const configured = !!URL_ && !!SERVICE && !URL_.includes("placeholder");
const d = configured ? describe : describe.skip;

d("QR namespace isolation", () => {
  let admin: SupabaseClient;
  let teamMemberId: string;
  let assignmentId: string;
  let campaignId: string;

  /** Deliberately used as BOTH a field-team QR code and an ambassador campaign code. */
  const sharedCode = generateTrackingCode();
  /** Exists only in the ambassador system. */
  const ambassadorOnlyCode = generateTrackingCode();
  /** Exists only in the field-team system. */
  const fieldOnlyCode = generateTrackingCode();

  let serverUp = false;

  beforeAll(async () => {
    admin = createClient(URL_!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    serverUp = await fetch(`${APP}/login`).then((r) => r.ok).catch(() => false);

    const { data: member } = await admin
      .from("team_members")
      .insert({ full_name: "Isolation Test Agent", status: "active" })
      .select("id")
      .single();
    teamMemberId = member!.id;

    const { data: assignment } = await admin
      .from("qr_assignments")
      .insert({
        team_member_id: teamMemberId,
        title: "Isolation Test Assignment",
        status: "active",
        reference_code: generateReferenceCode(),
      })
      .select("id")
      .single();
    assignmentId = assignment!.id;

    await admin.from("qr_codes").insert([
      {
        assignment_id: assignmentId,
        team_member_id: teamMemberId,
        platform: "ios",
        tracking_code: sharedCode,
        tracking_url: `${APP}/r/ios/${sharedCode}`,
        destination_url: process.env.IOS_APP_STORE_URL!,
        status: "active",
      },
      {
        assignment_id: assignmentId,
        team_member_id: teamMemberId,
        platform: "android",
        tracking_code: fieldOnlyCode,
        tracking_url: `${APP}/r/android/${fieldOnlyCode}`,
        destination_url: process.env.ANDROID_PLAY_STORE_URL!,
        status: "active",
      },
    ]);

    const { data: campaign } = await admin
      .from("ambassador_campaigns")
      .insert({
        title: "Isolation Test Campaign",
        status: "active",
        // The collision under test.
        tracking_code: sharedCode,
        tracking_url: `${APP}/a/${sharedCode}`,
        reference_code: generateReferenceCode(),
      })
      .select("id")
      .single();
    campaignId = campaign!.id;

    const { data: second } = await admin
      .from("ambassador_campaigns")
      .insert({
        title: "Isolation Test Campaign 2",
        status: "active",
        tracking_code: ambassadorOnlyCode,
        tracking_url: `${APP}/a/${ambassadorOnlyCode}`,
        reference_code: generateReferenceCode(),
      })
      .select("id")
      .single();
    // Tracked for cleanup via the same cascade as the first.
    expect(second!.id).toBeTruthy();
  });

  afterAll(async () => {
    await admin.from("ambassador_campaigns").delete().eq("tracking_code", sharedCode);
    await admin.from("ambassador_campaigns").delete().eq("tracking_code", ambassadorOnlyCode);
    if (assignmentId) await admin.from("qr_assignments").delete().eq("id", assignmentId);
    if (teamMemberId) await admin.from("team_members").delete().eq("id", teamMemberId);
  });

  it("sets up the same code in both systems at once", async () => {
    const [{ data: qr }, { data: campaign }] = await Promise.all([
      admin.from("qr_codes").select("id").eq("tracking_code", sharedCode).maybeSingle(),
      admin
        .from("ambassador_campaigns")
        .select("id")
        .eq("tracking_code", sharedCode)
        .maybeSingle(),
    ]);

    // If this ever fails the premise is gone and the assertions below prove nothing.
    expect(qr).toBeTruthy();
    expect(campaign).toBeTruthy();
  });

  it("sends the shared code down the app-store path when scanned as a field QR", async () => {
    if (!serverUp) return void console.warn(`SKIPPED: no dev server at ${APP}`);

    const res = await fetch(`${APP}/r/ios/${sharedCode}`, { redirect: "manual" });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("apps.apple.com");
    // Emphatically not the registration form.
    expect(res.headers.get("location")).not.toContain("/a/");
  });

  it("opens the form for the shared code when scanned as an ambassador QR", async () => {
    if (!serverUp) return void console.warn(`SKIPPED: no dev server at ${APP}`);

    const res = await fetch(`${APP}/a/${sharedCode}`, { redirect: "manual" });
    const html = await res.text();

    // A 200 page, not a redirect to any app store.
    expect(res.status).toBe(200);
    expect(html).toContain("Become a Mint Ambassador");
    expect(html).not.toContain("apps.apple.com");
    expect(html).not.toContain("play.google.com");
  });

  it("attributes each scan of the shared code to its own system only", async () => {
    if (!serverUp) return void console.warn(`SKIPPED: no dev server at ${APP}`);

    // Both routes log inside after(); allow them to settle.
    await new Promise((r) => setTimeout(r, 2500));

    const [{ data: qrScans }, { data: formViews }] = await Promise.all([
      admin.from("qr_scan_events").select("id").eq("assignment_id", assignmentId),
      admin.from("ambassador_scan_events").select("id").eq("campaign_id", campaignId),
    ]);

    // Exactly one each: the field scan did not also register as a form view, and the
    // form view did not also register as a store scan.
    expect(qrScans!.length).toBe(1);
    expect(formViews!.length).toBe(1);
  });

  it("fails safe when an ambassador code is presented to the field-team route", async () => {
    if (!serverUp) return void console.warn(`SKIPPED: no dev server at ${APP}`);

    const res = await fetch(`${APP}/r/ios/${ambassadorOnlyCode}`, { redirect: "manual" });

    // Falls back rather than resolving the code against the ambassador table.
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain(process.env.QR_FALLBACK_URL!);
  });

  it("fails safe when a field-team code is presented to the ambassador route", async () => {
    if (!serverUp) return void console.warn(`SKIPPED: no dev server at ${APP}`);

    const res = await fetch(`${APP}/a/${fieldOnlyCode}`, { redirect: "manual" });
    const html = await res.text();

    // Shows the inactive-link page rather than a form or a store redirect.
    expect(res.status).toBe(200);
    expect(html).toContain("isn&#x27;t active");
    expect(html).not.toContain("play.google.com");
  });
});
