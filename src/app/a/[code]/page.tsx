import { headers } from "next/headers";
import { after } from "next/server";
import { Leaf } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidTrackingCodeShape } from "@/lib/tracking-code";
import { extractClientIp, parseUserAgent } from "@/lib/user-agent";
import { AmbassadorRegistrationForm } from "@/components/ambassador/registration-form";

export const metadata = { title: "Become a Mint Ambassador · MintRewards" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PUBLIC ambassador registration form. No authentication -- opened straight from a
 * printed/shared QR code, same trust boundary as /r/[platform]/[code].
 *
 * Unlike that route this does not redirect: there is nowhere else to send a student
 * who scanned a "fill this form" QR, so an invalid or inactive code renders a plain
 * in-page message instead of a store fallback.
 */
export default async function AmbassadorFormPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  if (!isValidTrackingCodeShape(code)) {
    return <InvalidLink />;
  }

  const admin = createAdminClient();
  const { data: campaign, error } = await admin
    .from("ambassador_campaigns")
    .select("id, title, status")
    .eq("tracking_code", code)
    .maybeSingle();

  if (error || !campaign || campaign.status !== "active") {
    return <InvalidLink />;
  }

  const requestHeaders = await headers();
  const userAgent = requestHeaders.get("user-agent");
  const parsed = parseUserAgent(userAgent);
  const ipAddress = extractClientIp(requestHeaders);
  const campaignId = campaign.id;

  // Logged after the page is already on its way to the browser, same rule as the
  // scan redirect route: a logging hiccup must never slow down or fail the page a
  // real student is looking at.
  after(async () => {
    try {
      await admin.from("ambassador_scan_events").insert({
        campaign_id: campaignId,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_type: parsed.deviceType,
        browser: parsed.browser,
        os: parsed.os,
        is_bot: parsed.isBot,
      });
    } catch {
      // A missed view row costs one analytics data point, not the registration.
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <Leaf className="text-primary size-8" />
          <h1 className="text-xl font-semibold tracking-tight">Become a Mint Ambassador</h1>
          <p className="text-muted-foreground text-sm">{campaign.title}</p>
        </header>
        <AmbassadorRegistrationForm trackingCode={code} />
      </div>
    </div>
  );
}

function InvalidLink() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="max-w-sm space-y-2">
        <Leaf className="text-primary mx-auto size-8" />
        <h1 className="text-lg font-semibold">This link isn&apos;t active</h1>
        <p className="text-muted-foreground text-sm">
          This registration link is invalid or is no longer active. Please check with your
          MintRewards contact for the current sign-up link.
        </p>
      </div>
    </div>
  );
}
