import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { STANDEE_TEMPLATES, type StandeeLanguage } from "@/lib/standee/config";

const exec = promisify(execFile);

/**
 * Exercises the standee generation HTTP route the way the admin UI does: with a real
 * session cookie, against the real storage bucket.
 *
 * Every assignment produces BOTH an English and an Urdu sheet from the same tracking
 * codes, so these tests check the wiring (auth, dual upload, per-language rows, signed
 * links) and then decode the delivered PDFs to prove each QR landed in the correct card.
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

async function hasPdftoppm(): Promise<boolean> {
  try {
    await exec("pdftoppm", ["-v"]);
    return true;
  } catch {
    return false;
  }
}

/** Decodes the QR inside one box of the rendered page. Rendered at 72dpi: 1px = 1pt. */
function decodeBox(
  png: PNG,
  box: { x: number; y: number; width: number; height: number },
  pageHeight: number,
): string | null {
  // config y is measured from the bottom (pdf-lib); image y is from the top.
  const top = Math.round(pageHeight - box.y - box.height);
  const left = Math.round(box.x);
  const w = Math.round(box.width);
  const h = Math.round(box.height);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const s = ((top + j) * png.width + (left + i)) * 4;
      const t = (j * w + i) * 4;
      data[t] = png.data[s];
      data[t + 1] = png.data[s + 1];
      data[t + 2] = png.data[s + 2];
      data[t + 3] = 255;
    }
  }
  return jsQR(data, w, h)?.data ?? null;
}

d("standee generation route", () => {
  let admin: SupabaseClient;
  let cookie: string;
  let userId: string;
  let memberId: string;
  let assignmentId: string;
  let filePaths: string[] = [];
  let trackingUrls: Record<"ios" | "android", string>;

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
    const { assignment, qrCodes } = await createAssignmentWithQrCodes(
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
    trackingUrls = {
      ios: qrCodes.find((c) => c.platform === "ios")!.tracking_url,
      android: qrCodes.find((c) => c.platform === "android")!.tracking_url,
    };
  });

  afterAll(async () => {
    if (filePaths.length > 0) {
      await admin.storage
        .from(process.env.GENERATED_STANDEES_BUCKET ?? "generated-standees")
        .remove(filePaths);
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

  it("generates BOTH an English and an Urdu standee from one request", async () => {
    const res = await fetch(`${APP}/api/assignments/${assignmentId}/standee`, {
      method: "POST",
      headers: { cookie },
    });
    const body = await res.json();
    expect(res.status, body.error).toBe(200);

    const standees = body.standees as { language: string; url: string; filePath: string }[];
    expect(standees).toHaveLength(2);
    expect(standees.map((s) => s.language).sort()).toEqual(["english", "urdu"]);
    filePaths = standees.map((s) => s.filePath);

    // Each language must be a distinct stored object, not the same file listed twice.
    expect(new Set(filePaths).size).toBe(2);

    for (const s of standees) {
      const pdfRes = await fetch(s.url);
      expect(pdfRes.ok, `${s.language} download failed`).toBe(true);
      const buf = Buffer.from(await pdfRes.arrayBuffer());
      expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
      // Guards against a truncated or empty upload. Deliberately a low floor rather
      // than a tight bound: artwork changes legitimately (the English standee moved
      // from a 12"x30" sheet to A4 and shrank from ~1.4 MB to ~210 KB), and a size
      // assertion tuned to one design would fail on the next redesign for no reason.
      expect(buf.byteLength).toBeGreaterThan(50_000);
    }
  });

  it("returns fresh links for both languages on GET", async () => {
    const res = await fetch(`${APP}/api/assignments/${assignmentId}/standee`, {
      headers: { cookie },
    });
    const body = await res.json();
    expect(res.status, body.error).toBe(200);
    const standees = body.standees as { language: string }[];
    expect(standees.map((s) => s.language).sort()).toEqual(["english", "urdu"]);
  });

  /**
   * The check that matters most for the dual-language feature.
   *
   * The Urdu sheet is RTL-mirrored -- iOS right, Android left. Reusing the English
   * coordinates would produce a perfectly valid-looking PDF that sends every iPhone user
   * to the Play Store. Only decoding the delivered output catches that.
   */
  it("puts each platform's QR in the correct card, per template", async () => {
    if (!(await hasPdftoppm())) {
      console.warn("SKIPPED placement assertions: pdftoppm (poppler) not installed");
      return;
    }

    const res = await fetch(`${APP}/api/assignments/${assignmentId}/standee`, {
      headers: { cookie },
    });
    const body = await res.json();
    expect(res.status, body.error).toBe(200);

    for (const s of body.standees as { language: StandeeLanguage; url: string }[]) {
      const buf = Buffer.from(await (await fetch(s.url)).arrayBuffer());
      const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `standee-${s.language}-`));
      const pdfPath = path.join(dir, "out.pdf");
      await fs.promises.writeFile(pdfPath, buf);
      await exec("pdftoppm", ["-png", "-r", "72", "-f", "1", "-l", "1", pdfPath,
                              path.join(dir, "page")]);
      const png = PNG.sync.read(await fs.promises.readFile(path.join(dir, "page-1.png")));

      const tpl = STANDEE_TEMPLATES[s.language];
      expect(decodeBox(png, tpl.iosQrBox, tpl.pageSize.height), `${s.language} iOS`)
        .toBe(trackingUrls.ios);
      expect(decodeBox(png, tpl.androidQrBox, tpl.pageSize.height), `${s.language} Android`)
        .toBe(trackingUrls.android);

      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  });

  it("links one row per language to the assignment", async () => {
    const { data } = await admin
      .from("generated_standees")
      .select("*")
      .eq("assignment_id", assignmentId);

    const byLang: Record<string, { template_name: string; file_type: string; generated_by: string }> =
      Object.fromEntries(data!.map((r) => [r.language, r]));
    expect(Object.keys(byLang).sort()).toEqual(["english", "urdu"]);

    for (const row of data!) {
      expect(row.file_type).toBe("pdf");
      expect(row.generated_by).toBe(userId);
    }
    // template_name must reflect the template actually used, not a hardcoded default.
    expect(byLang.english.template_name).toContain("English");
    expect(byLang.urdu.template_name).toContain("Urdu");
  });

  it("keeps the standees bucket private", async () => {
    // A public bucket would expose every generated standee by guessable path.
    const anon = createClient(URL_!, ANON!, { auth: { persistSession: false } });
    const { data } = await anon.storage
      .from(process.env.GENERATED_STANDEES_BUCKET ?? "generated-standees")
      .download(filePaths[0]);
    expect(data).toBeNull();
  });
});
