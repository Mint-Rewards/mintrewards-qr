import { createServerSupabase } from "@/lib/supabase/server";
import { csvResponse, stamped, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("v_team_member_performance")
    .select("*")
    .order("total_scans", { ascending: false });

  if (error) return new Response(error.message, { status: 500 });

  const csv = toCsv(data ?? [], [
    { key: "full_name", header: "Team Member" },
    { key: "phone", header: "Phone" },
    { key: "email", header: "Email" },
    { key: "city", header: "City" },
    { key: "region", header: "Region" },
    { key: "status", header: "Status" },
    { key: "total_assignments", header: "Total Assignments" },
    { key: "active_assignments", header: "Active Assignments" },
    { key: "total_scans", header: "Total Scans" },
    { key: "ios_scans", header: "iOS Scans" },
    { key: "android_scans", header: "Android Scans" },
    { key: "scans_last_7d", header: "Scans (7d)" },
    { key: "last_scan_at", header: "Last Scan" },
  ]);

  return csvResponse(csv, stamped("mintrewards-team-members"));
}
