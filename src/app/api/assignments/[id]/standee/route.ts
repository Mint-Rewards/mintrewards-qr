import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateStandeePdf, standeeStoragePath } from "@/lib/standee/generate";
import { DEFAULT_STANDEE_LANGUAGE } from "@/lib/standee/config";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signed download links are short-lived; the bucket stays private. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Generates (or regenerates) the printable standee for an assignment.
 *
 * Auth is checked with the session client first; only then does the service-role client
 * touch storage. Regenerating is always allowed and always produces a NEW object rather
 * than overwriting: a previously downloaded PDF may already be at a print vendor, so
 * history stays intact and auditable.
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

  try {
    const language = DEFAULT_STANDEE_LANGUAGE;
    const { pdf, template } = await generateStandeePdf({
      iosTrackingUrl: ios.tracking_url,
      androidTrackingUrl: android.tracking_url,
      language,
    });

    // Storage writes and the generated_standees insert use the service role: the bucket
    // is private and qr/standee rows are not client-writable.
    const admin = createAdminClient();
    const filePath = standeeStoragePath(id, assignment.reference_code, language);

    const { error: uploadError } = await admin.storage
      .from(env.GENERATED_STANDEES_BUCKET)
      .upload(filePath, pdf, { contentType: "application/pdf", upsert: false });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { error: insertError } = await admin.from("generated_standees").insert({
      assignment_id: id,
      template_name: template.templateName,
      language,
      file_path: filePath,
      file_type: "pdf",
      generated_by: user.id,
    });

    if (insertError) throw new Error(`Record failed: ${insertError.message}`);

    const { data: signed, error: signError } = await admin.storage
      .from(env.GENERATED_STANDEES_BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed) throw new Error("Could not create download link.");

    return NextResponse.json({ url: signed.signedUrl, filePath });
  } catch (err) {
    // Surfaced to an authenticated admin, so a real message is useful here -- unlike the
    // public redirect route, which must never reveal internals.
    const message = err instanceof Error ? err.message : "Standee generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Fresh signed link for the most recent standee, since links expire. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: latest } = await supabase
    .from("generated_standees")
    .select("file_path")
    .eq("assignment_id", id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) {
    return NextResponse.json({ error: "No standee generated yet." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from(env.GENERATED_STANDEES_BUCKET)
    .createSignedUrl(latest.file_path, SIGNED_URL_TTL_SECONDS);

  if (error || !signed) {
    return NextResponse.json({ error: "Could not create download link." }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, filePath: latest.file_path });
}
