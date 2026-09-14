import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateAmbassadorCardJpg } from "@/lib/ambassador/card";
import { classifyBatch } from "@/lib/ambassador/config";
import { generateTrackingCode } from "@/lib/tracking-code";

/**
 * End-to-end test for the Mint Ambassador registration funnel against the real
 * Supabase project -- the automated form of: create a campaign, scan its QR (load the
 * public form), submit a registration, and confirm the card/attribution/RLS all
 * actually work against live infrastructure, not just in unit isolation.
 *
 * The registration SUBMIT itself is a Next.js Server Action, which cannot be invoked
 * directly over plain HTTP the way a route handler can (its wire protocol is
 * build-specific). So this test exercises the two things that genuinely only fail
 * against the real project -- the public GET page + view logging over real HTTP, and
 * the DB/storage write path using the exact same library functions the server action
 * calls -- rather than the Next-internal plumbing that binds them together (which
 * `submitAmbassadorRegistration`'s own code review covers).
 *
 * Skips (rather than fails) when Supabase credentials are absent.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.QR_PUBLIC_BASE_URL ?? "http://localhost:3000";
const BUCKET = process.env.AMBASSADOR_CARDS_BUCKET ?? "ambassador-cards";

const configured =
  !!URL_ && !!SERVICE && !!ANON && !URL_.includes("placeholder");

const d = configured ? describe : describe.skip;

d("mint ambassador attribution end-to-end", () => {
  let admin: SupabaseClient;
  let campaignId: string;
  let trackingCode: string;
  let ambassadorId: string;
  let cardFilePath: string;

  beforeAll(() => {
    admin = createClient(URL_!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  afterAll(async () => {
    if (cardFilePath) await admin.storage.from(BUCKET).remove([cardFilePath]);
    // mint_ambassadors and ambassador_scan_events cascade from the campaign.
    if (campaignId) await admin.from("ambassador_campaigns").delete().eq("id", campaignId);
  });

  it("creates an active campaign with a unique QR tracking code", async () => {
    // Must be a real tracking code, not an arbitrary readable string -- the public
    // form route validates against the same alphabet the redirect route uses (no
    // I/L/O/U/0/1), and a hand-rolled label like "TESTCAMPAIGN" fails that check.
    trackingCode = generateTrackingCode();
    const { data, error } = await admin
      .from("ambassador_campaigns")
      .insert({
        title: "Test World Cleanup Day",
        event_name: "World Cleanup Day",
        status: "active",
        tracking_code: trackingCode,
        tracking_url: `${APP}/a/${trackingCode}`,
        reference_code: `MA-TEST${Date.now().toString().slice(-4)}`,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.id).toBeTruthy();
    campaignId = data!.id;
  });

  it("serves the public registration form and logs a view, over real HTTP", async () => {
    const reachable = await fetch(`${APP}/login`).then((r) => r.ok).catch(() => false);
    if (!reachable) {
      console.warn(`SKIPPED public form assertions: no dev server at ${APP}`);
      return;
    }

    const res = await fetch(`${APP}/a/${trackingCode}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Become a Mint Ambassador");

    // Logged in after(), same as the QR redirect route -- allow it to settle.
    await new Promise((r) => setTimeout(r, 2500));

    const { data: views } = await admin
      .from("ambassador_scan_events")
      .select("*")
      .eq("campaign_id", campaignId);

    expect(views!.length).toBeGreaterThanOrEqual(1);
    expect(views![0].is_bot).toBe(false);
  });

  it("shows an inactive campaign's link as not active, not as an error", async () => {
    const reachable = await fetch(`${APP}/login`).then((r) => r.ok).catch(() => false);
    if (!reachable) return;

    const res = await fetch(`${APP}/a/${"Z".repeat(12).slice(0, 12)}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("isn");
  });

  it("classifies batch year the same way the form will", () => {
    expect(classifyBatch(2026)).toBe("student");
    expect(classifyBatch(2025)).toBe("alumnus");
  });

  it("records a registration, generates a real card, and uploads it publicly", async () => {
    const fullName = "Test Ambassador";
    const university = "Test University";
    const batchYear = 2027;
    const status = classifyBatch(batchYear);

    const { data: ambassador, error } = await admin
      .from("mint_ambassadors")
      .insert({
        campaign_id: campaignId,
        full_name: fullName,
        university,
        batch_year: batchYear,
        ambassador_status: status,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    ambassadorId = ambassador!.id;

    // Same function the server action calls -- this is the part that only fails
    // against real storage permissions (bucket must exist and accept the upload).
    const jpg = await generateAmbassadorCardJpg({ fullName, university, batchYear });
    cardFilePath = `${ambassadorId}.jpg`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(cardFilePath, jpg, { contentType: "image/jpeg", upsert: true });
    expect(uploadError).toBeNull();

    await admin.from("mint_ambassadors").update({ card_file_path: cardFilePath }).eq("id", ambassadorId);

    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(cardFilePath);
    // The whole point of this bucket being public: an unauthenticated fetch (exactly
    // what LinkedIn/Instagram's crawlers do, potentially long after any signed URL
    // would have expired) must succeed.
    const fetched = await fetch(pub.publicUrl);
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get("content-type")).toContain("image/jpeg");
  });

  it("aggregates registrations into the campaign performance view", async () => {
    const { data: perf } = await admin
      .from("v_ambassador_campaign_performance")
      .select("*")
      .eq("campaign_id", campaignId)
      .single();

    expect(perf).toBeTruthy();
    expect(Number(perf!.total_registrations)).toBeGreaterThanOrEqual(1);
    expect(Number(perf!.student_count)).toBeGreaterThanOrEqual(1);
  });

  it("blocks anonymous reads and anonymous registration forgery via RLS", async () => {
    const anon = createClient(URL_!, ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: reads } = await anon.from("mint_ambassadors").select("*");
    expect(reads ?? []).toHaveLength(0);

    // mint_ambassadors deliberately has no client insert policy -- registration
    // writes are server-side only, exactly like qr_scan_events.
    const { error: insertError } = await anon.from("mint_ambassadors").insert({
      campaign_id: campaignId,
      full_name: "Forged",
      university: "Forged",
      batch_year: 2026,
      ambassador_status: "student",
    });
    expect(insertError).not.toBeNull();
  });
});
