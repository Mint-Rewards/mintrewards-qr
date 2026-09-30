import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateStandeePdf, standeeStoragePath } from "@/lib/standee/generate";
import { STANDEE_LANGUAGES, type StandeeLanguage } from "@/lib/standee/config";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signed download links are short-lived; the bucket stays private. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface StandeeResult {
  language: StandeeLanguage;
  url: string;
  filePath: string;
}

/**
 * Generates (or regenerates) the printable standees for an assignment.
 *
 * Every assignment produces BOTH an English and an Urdu standee from the same pair of
 * tracking codes, so the two sheets are interchangeable in the field and a scan is
 * attributed identically whichever one the resident reads.
 *
 * The Urdu template is RTL-mirrored (iOS right, Android left). That mapping lives in
 * standee/config.ts and is applied per-template, never assumed from position.
 *
 * Both PDFs are rendered before anything is uploaded, and uploads are rolled back if a
 * later step fails, so an assignment never ends up with one language stored and the
 * other missing.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: assignment } = await supabase
    .from("qr_assignments")
    .select("id, title, reference_code")
    .eq("id", id)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const { data: codes } = await supabase
    .from("qr_codes")
    .select("platform, tracking_url")
    .eq("assignment_id", id);

  const ios = codes?.find((c) => c.platform === "ios");
  const android = codes?.find((c) => c.platform === "android");

  if (!ios || !android) {
    return NextResponse.json(
      { error: "This assignment is missing its iOS or Android QR code." },
      { status: 409 },
    );
  }

  const admin = createAdminClient();
  const uploaded: string[] = [];

  try {
    // Render every language up front: a template or coordinate problem should fail
    // before anything reaches storage.
    const rendered = await Promise.all(
      STANDEE_LANGUAGES.map(async (language) => {
        const { pdf, template } = await generateStandeePdf({
          iosTrackingUrl: ios.tracking_url,
          androidTrackingUrl: android.tracking_url,
          language,
        });
        return { language, pdf, template };
      }),
    );

    const results: StandeeResult[] = [];

    for (const { language, pdf, template } of rendered) {
      const filePath = standeeStoragePath(id, assignment.reference_code, language);

      const { error: uploadError } = await admin.storage
        .from(env.GENERATED_STANDEES_BUCKET)
        .upload(filePath, pdf, { contentType: "application/pdf", upsert: false });

      if (uploadError) throw new Error(`Upload failed (${language}): ${uploadError.message}`);
      uploaded.push(filePath);

      const { error: insertError } = await admin.from("generated_standees").insert({
        assignment_id: id,
        template_name: template.templateName,
        language,
        file_path: filePath,
        file_type: "pdf",
        generated_by: user.id,
      });

      if (insertError) throw new Error(`Record failed (${language}): ${insertError.message}`);

      const { data: signed, error: signError } = await admin.storage
        .from(env.GENERATED_STANDEES_BUCKET)
        .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

      if (signError || !signed) throw new Error(`Could not create ${language} download link.`);

      results.push({ language, url: signed.signedUrl, filePath });
    }

    return NextResponse.json({ standees: results });
  } catch (err) {
    // Leave no half-generated set behind: an assignment showing only one language would
    // be worse than showing none, because it looks complete.
    if (uploaded.length > 0) {
      await admin.storage.from(env.GENERATED_STANDEES_BUCKET).remove(uploaded);
      await admin
        .from("generated_standees")
        .delete()
        .in("file_path", uploaded);
    }
    const message = err instanceof Error ? err.message : "Standee generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Fresh signed links for the most recent standee of each language. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows } = await supabase
    .from("generated_standees")
    .select("language, file_path, generated_at")
    .eq("assignment_id", id)
    .order("generated_at", { ascending: false });

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "No standee generated yet." }, { status: 404 });
  }

  // Rows are newest-first, so the first occurrence of each language is its latest.
  const latest = new Map<string, string>();
  for (const row of rows) {
    if (!latest.has(row.language)) latest.set(row.language, row.file_path);
  }

  const admin = createAdminClient();
  const standees: StandeeResult[] = [];

  for (const language of STANDEE_LANGUAGES) {
    const filePath = latest.get(language);
    if (!filePath) continue;
    const { data: signed } = await admin.storage
      .from(env.GENERATED_STANDEES_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);
    if (signed) standees.push({ language, url: signed.signedUrl, filePath });
  }

  if (standees.length === 0) {
    return NextResponse.json({ error: "Could not create download links." }, { status: 500 });
  }

  return NextResponse.json({ standees });
}
