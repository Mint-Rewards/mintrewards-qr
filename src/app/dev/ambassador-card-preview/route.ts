import { createServerSupabase } from "@/lib/supabase/server";
import { generateAmbassadorCardJpg } from "@/lib/ambassador/card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Developer calibration utility, same purpose as /dev/standee-preview: renders a card
 * with dummy data so NAME_BOX/UNIVERSITY_BOX/BATCH_BOX in card-config.ts can be
 * checked visually without a real registration. Once the real template lands in
 * templates/, reload this to see it composited with the calibration text boxes.
 *
 * Auth-gated: same reasoning as the standee preview, even though the output here is
 * closer to public (a real card is a public JPG) -- while calibrating, the template
 * itself may not be final brand material yet.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const batchYear = Number(url.searchParams.get("batchYear") ?? "2026");

  try {
    const jpg = await generateAmbassadorCardJpg({
      fullName: url.searchParams.get("name") ?? "Preview Student",
      university: url.searchParams.get("university") ?? "Sample University",
      batchYear: Number.isFinite(batchYear) ? batchYear : 2026,
    });

    return new Response(jpg as BodyInit, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Disposition": 'inline; filename="ambassador-card-preview.jpg"',
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
