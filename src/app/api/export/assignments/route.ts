import { createServerSupabase } from "@/lib/supabase/server";
import { csvResponse, stamped, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("v_assignment_performance")
    .select("*")
    .order("total_scans", { ascending: false });

  if (error) return new Response(error.message, { status: 500 });

  const csv = toCsv(data ?? [], [
    { key: "title", header: "Assignment" },
    { key: "reference_code", header: "Reference Code" },
    { key: "team_member_name", header: "Team Member" },
    { key: "location_name", header: "Location" },
    { key: "location_type", header: "Location Type" },
    { key: "city", header: "City" },
    { key: "area", header: "Area" },
    { key: "status", header: "Status" },
    { key: "campaign_start_date", header: "Campaign Start" },
    { key: "campaign_end_date", header: "Campaign End" },
    { key: "total_scans", header: "Total Scans" },
    { key: "ios_scans", header: "iOS Scans" },
    { key: "android_scans", header: "Android Scans" },
    { key: "scans_last_7d", header: "Scans (7d)" },
    { key: "last_scan_at", header: "Last Scan" },
  ]);

  return csvResponse(csv, stamped("mintrewards-assignments"));
}
