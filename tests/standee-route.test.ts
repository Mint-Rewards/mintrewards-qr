import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";

/**
 * Exercises the standee generation HTTP route the way the admin UI does: with a real
 * session cookie, against the real storage bucket.
 *
 * The unit test in standee.test.ts proves the QR codes land in the right placeholders.
 * This proves the surrounding wiring -- auth gate, storage upload, generated_standees
 * linkage and signed download URL -- actually works, which is the part that only fails
 * in production.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.QR_PUBLIC_BASE_URL ?? "http://localhost:3000";
const PW_FILE = process.env.E2E_ADMIN_PASSWORD_FILE;
const EMAIL = process.env.E2E_ADMIN_EMAIL;

const password =
  process.env.E2E_ADMIN_PASSWORD ??
  (PW_FILE && fs.existsSync(PW_FILE) ? fs.readFileSync(PW_FILE, "utf8").trim() : null);

const configured =
  !!URL_ && !!SERVICE && !!ANON && !!EMAIL && !!password && !URL_.includes("placeholder");

const d = configured ? describe : describe.skip;

d("standee generation route", () => {
  let admin: SupabaseClient;
  let cookie: string;
  let userId: string;
  let memberId: string;
  let assignmentId: string;
  let filePath: string | undefined;

  beforeAll(async () => {
    admin = createClient(URL_!, SERVICE!, { auth: { persistSession: false } });

    const anon = createClient(URL_!, ANON!, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({
      email: EMAIL!,
      password: password!,
    });
    if (error) throw error;

    userId = data.user.id;
    // @supabase/ssr reads the session from a base64-encoded JSON cookie.
    const ref = URL_!.match(/https:\/\/([^.]+)\./)![1];
    cookie = `sb-${ref}-auth-token=base64-${Buffer.from(
      JSON.stringify(data.session),
    ).toString("base64")}`;

    const { data: member } = await admin
      .from("team_members")
      .insert({ full_name: "Standee Route Test", city: "Karachi", status: "active" })
      .select()
      .single();
    memberId = member!.id;

    const { createAssignmentWithQrCodes } = await import("@/lib/assignments");
    const { assignment } = await createAssignmentWithQrCodes(
      admin,
      {
        team_member_id: memberId,
        title: "Bahria Town Society Gate 2",
        location_name: "Bahria Town",
        location_type: "society",
        city: "Karachi",
        status: "active",
      },
      userId,
    );
    assignmentId = assignment.id;
  });

  afterAll(async () => {
    if (filePath) {
      await admin.storage
        .from(process.env.GENERATED_STANDEES_BUCKET ?? "generated-standees")
        .remove([filePath]);
    }
    if (assignmentId) await admin.from("qr_assignments").delete().eq("id", assignmentId);
    if (memberId) await admin.from("team_members").delete().eq("id", memberId);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${APP}/api/assignments/${assignmentId}/standee`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("generates, stores and returns a downloadable PDF", async () => {
    const res = await fetch(`${APP}/api/assignments/${assignmentId}/standee`, {
      method: "POST",
      headers: { cookie },
    });
    const body = await res.json();
    expect(res.status, body.error).toBe(200);
    expect(body.url).toContain("http");
    filePath = body.filePath;

    // The signed URL must serve a real PDF, not an error page.
    const pdfRes = await fetch(body.url);
    expect(pdfRes.ok).toBe(true);
    const buf = Buffer.from(await pdfRes.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    // The template alone is ~1.4 MB; a truncated or empty upload would be far smaller.
    expect(buf.byteLength).toBeGreaterThan(500_000);
  });

  it("links the generated standee to the assignment", async () => {
    const { data } = await admin
      .from("generated_standees")
      .select("*")
      .eq("assignment_id", assignmentId);

    expect(data!.length).toBeGreaterThanOrEqual(1);
    expect(data![0].file_type).toBe("pdf");
    expect(data![0].generated_by).toBe(userId);
    expect(data![0].template_name).toContain("English");
  });

  it("keeps the standees bucket private", async () => {
    // A public bucket would expose every generated standee by guessable path.
    const anon = createClient(URL_!, ANON!, { auth: { persistSession: false } });
    const { data } = await anon.storage
      .from(process.env.GENERATED_STANDEES_BUCKET ?? "generated-standees")
      .download(filePath!);
    expect(data).toBeNull();
  });
});
