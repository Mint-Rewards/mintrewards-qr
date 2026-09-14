import { createServerSupabase } from "@/lib/supabase/server";
import { buildAmbassadorUrl } from "@/lib/env";
import { generateQrSvg } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Downloads a campaign's QR as vector art, for posters and social posts.
 *
 * The payload is built from the tracking CODE and the CURRENT base URL, exactly as the
 * campaign page does -- never from the stored tracking_url, which records whatever
 * domain the campaign happened to be created under. A designer pulling artwork from a
 * preview deployment should still get a code pointing at production.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: campaign } = await supabase
    .from("ambassador_campaigns")
    .select("tracking_code, reference_code")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) return new Response("Campaign not found", { status: 404 });

  const svg = await generateQrSvg(buildAmbassadorUrl(campaign.tracking_code));

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition":
        `attachment; filename="mint-ambassador-qr-${campaign.reference_code}.svg"`,
      "Cache-Control": "no-store",
    },
  });
}
