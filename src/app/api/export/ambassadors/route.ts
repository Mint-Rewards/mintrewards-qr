import { createServerSupabase } from "@/lib/supabase/server";
import { csvResponse, stamped, toCsv } from "@/lib/csv";
import { AMBASSADOR_STATUS_LABELS } from "@/lib/ambassador/config";

export const dynamic = "force-dynamic";

/** Mint Ambassador registrations, optionally scoped to one campaign. */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaign_id");

  let query = supabase
    .from("mint_ambassadors")
    .select(
      `full_name, university, batch_year, ambassador_status, created_at,
       ambassador_campaigns ( title, reference_code, event_name, city )`,
    )
    .order("created_at", { ascending: false })
    .limit(50_000);

  if (campaignId) query = query.eq("campaign_id", campaignId);

  const { data, error } = await query;
  if (error) return new Response(error.message, { status: 500 });

  type Embedded = Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  type Row = Record<string, unknown> & { ambassador_campaigns?: Embedded };

  const one = (e: Embedded): Record<string, unknown> =>
    Array.isArray(e) ? (e[0] ?? {}) : (e ?? {});

  const rows = ((data ?? []) as unknown as Row[]).map((raw) => {
    const campaign = one(raw.ambassador_campaigns);
    return {
      full_name: raw.full_name,
      university: raw.university,
      batch_year: raw.batch_year,
      status: AMBASSADOR_STATUS_LABELS[raw.ambassador_status as "student" | "alumnus"],
      campaign: campaign.title ?? "",
      reference_code: campaign.reference_code ?? "",
      event_name: campaign.event_name ?? "",
      city: campaign.city ?? "",
      registered_at: raw.created_at,
    };
  });

  const csv = toCsv(rows, [
    { key: "full_name", header: "Full Name" },
    { key: "university", header: "University" },
    { key: "batch_year", header: "Batch Year" },
    { key: "status", header: "Status" },
    { key: "campaign", header: "Campaign" },
    { key: "reference_code", header: "Reference Code" },
    { key: "event_name", header: "Event" },
    { key: "city", header: "City" },
    { key: "registered_at", header: "Registered At" },
  ]);

  return csvResponse(csv, stamped("mint-ambassadors"));
}
