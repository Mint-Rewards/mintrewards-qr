import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { isValidTrackingCodeShape } from "@/lib/tracking-code";
import { extractClientIp, parseUserAgent } from "@/lib/user-agent";

/**
 * PUBLIC QR redirect. No authentication.
 *
 * This is the only route a real member of the public ever touches, and it runs while
 * someone stands in front of a printed standee with their phone out. Three rules govern
 * everything here:
 *
 *   1. REDIRECT FIRST, LOG AFTER. The scan event is written inside `after()`, so
 *      logging never sits between the scan and the App Store.
 *   2. NEVER FAIL VISIBLY. Any error -- bad code, database down, malformed input --
 *      redirects to the public fallback. A scanner must never see a stack trace or a
 *      404, because the standee is already printed and in the field.
 *   3. NEVER CACHE. A cached redirect is a silently lost scan event, and the resulting
 *      under-count is invisible until the analytics look wrong.
 */

// The route must execute per request: it writes a scan row every time.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Platform = "ios" | "android";

function redirect(url: string) {
  const res = NextResponse.redirect(url, 302);
  // Rule 3. Without this, a CDN or the browser can serve the redirect without ever
  // reaching this handler again, and those scans are never recorded.
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ platform: string; code: string }> },
) {
  const { platform: rawPlatform, code } = await context.params;

  try {
    const platform = rawPlatform === "ios" || rawPlatform === "android"
      ? (rawPlatform as Platform)
      : null;

    // Cheap shape check first, so obviously malformed or probing requests never reach
    // the database.
    if (!platform || !isValidTrackingCodeShape(code)) {
      return redirect(env.QR_FALLBACK_URL);
    }

    const supabase = createAdminClient();

    // Single indexed lookup on the unique tracking_code -- the hot path.
    const { data: qr, error } = await supabase
      .from("qr_codes")
      .select("id, assignment_id, team_member_id, platform, destination_url, status")
      .eq("tracking_code", code)
      .maybeSingle();

    if (error || !qr || qr.platform !== platform || qr.status !== "active") {
      // Unknown, mismatched or disabled code. Fallback, silently.
      return redirect(env.QR_FALLBACK_URL);
    }

    // The destination is the QR code's OWN platform, resolved when the code was created.
    // It is never derived from the user agent: an iOS QR always goes to the App Store,
    // even when scanned from an Android phone. The detected OS is recorded separately so
    // mismatches remain visible in analytics.
    const destination = qr.destination_url || fallbackDestination(platform);

    const headers = request.headers;
    const userAgent = headers.get("user-agent");
    const parsed = parseUserAgent(userAgent);

    // Rule 1: everything below runs AFTER the response is already on its way.
    after(async () => {
      try {
        await supabase.from("qr_scan_events").insert({
          qr_code_id: qr.id,
          assignment_id: qr.assignment_id,
          team_member_id: qr.team_member_id,
          platform,
          ip_address: extractClientIp(headers),
          user_agent: userAgent,
          referrer: headers.get("referer"),
          device_type: parsed.deviceType,
          browser: parsed.browser,
          os: parsed.os,
          redirected_to: destination,
          is_bot: parsed.isBot,
        });
      } catch {
        // Rule 2. A logging failure costs one analytics row; it must never affect,
        // delay or surface to the person scanning.
      }
    });

    return redirect(destination);
  } catch {
    // Total failure -- still send the user somewhere useful.
    return redirect(env.QR_FALLBACK_URL);
  }
}

function fallbackDestination(platform: Platform): string {
  return platform === "ios" ? env.IOS_APP_STORE_URL : env.ANDROID_PLAY_STORE_URL;
}
