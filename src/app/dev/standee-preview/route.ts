import { createServerSupabase } from "@/lib/supabase/server";
import { generateStandeePdf } from "@/lib/standee/generate";
import { STANDEE_TEMPLATES, type StandeeLanguage } from "@/lib/standee/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Developer calibration utility (spec §7).
 *
 * Renders a standee with dummy tracking codes so QR placement can be verified visually
 * without creating a real assignment. Pass ?language=urdu to check the mirrored template.
 *
 * Auth-gated: it streams the branded template, which is not public material.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const requested = url.searchParams.get("language") ?? "english";
  const language: StandeeLanguage =
    requested === "urdu" ? "urdu" : "english";

  if (!STANDEE_TEMPLATES[language]) {
    return new Response(`Unknown template language: ${requested}`, { status: 400 });
  }

  try {
    const { pdf } = await generateStandeePdf({
      iosTrackingUrl: "https://example.test/r/ios/PREVIEW23456",
      androidTrackingUrl: "https://example.test/r/android/PREVIEW78923",
      language,
    });

    return new Response(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="standee-preview-${language}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response(
      err instanceof Error ? err.message : "Preview failed.",
      { status: 500 },
    );
  }
}
