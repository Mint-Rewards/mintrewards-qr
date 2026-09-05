/**
 * Minimal user-agent parsing for scan analytics.
 *
 * Deliberately hand-rolled rather than pulling in a UA-parsing library: this runs on the
 * redirect hot path, we need only four coarse fields, and the dependency's cold-start
 * cost is not worth it. If richer device data is ever needed, swap in `ua-parser-js`
 * behind this same interface.
 *
 * IMPORTANT: the parsed OS is recorded for analytics ONLY. The redirect destination is
 * always driven by the QR code's own platform, never by sniffing the user agent -- an
 * iOS QR always goes to the App Store. Recording both lets us spot mismatches
 * ("scanned the Android code on an iPhone"), which is real signal about standee layout
 * and placement.
 */

export interface ParsedUserAgent {
  deviceType: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  browser: string | null;
  os: "ios" | "android" | "windows" | "macos" | "linux" | "other" | null;
  isBot: boolean;
}

/**
 * Link-preview fetchers hit tracking URLs whenever someone pastes one into a chat.
 * They are flagged, never dropped: excluding them from headline metrics keeps the
 * numbers meaningful, while retaining the rows keeps them auditable.
 */
const BOT_PATTERNS = [
  "bot", "crawler", "spider", "slurp", "facebookexternalhit", "whatsapp",
  "telegrambot", "slackbot", "discordbot", "twitterbot", "linkedinbot",
  "embedly", "quora link preview", "pinterest", "redditbot", "applebot",
  "skypeuripreview", "googlebot", "bingbot", "headlesschrome", "curl",
  "wget", "python-requests", "axios", "go-http-client", "postman",
];

export function parseUserAgent(raw: string | null | undefined): ParsedUserAgent {
  if (!raw) {
    return { deviceType: "unknown", browser: null, os: null, isBot: false };
  }

  const ua = raw.toLowerCase();
  const isBot = BOT_PATTERNS.some((p) => ua.includes(p));

  // OS. Order matters: iPadOS reports "macintosh" plus touch support, and Android
  // devices also contain "linux", so the more specific tests must come first.
  let os: ParsedUserAgent["os"] = "other";
  if (/iphone|ipod/.test(ua)) os = "ios";
  else if (/ipad/.test(ua)) os = "ios";
  else if (/android/.test(ua)) os = "android";
  else if (/windows/.test(ua)) os = "windows";
  else if (/macintosh|mac os x/.test(ua)) os = "macos";
  else if (/linux|x11/.test(ua)) os = "linux";

  // Browser. Chrome must be tested after the Chromium forks that also claim "chrome",
  // and Safari after Chrome for the same reason.
  let browser: string | null = null;
  if (/edg\//.test(ua)) browser = "Edge";
  else if (/opr\/|opera/.test(ua)) browser = "Opera";
  else if (/samsungbrowser/.test(ua)) browser = "Samsung Internet";
  else if (/firefox|fxios/.test(ua)) browser = "Firefox";
  else if (/crios/.test(ua)) browser = "Chrome";
  else if (/chrome|chromium/.test(ua)) browser = "Chrome";
  else if (/safari/.test(ua)) browser = "Safari";

  let deviceType: ParsedUserAgent["deviceType"];
  if (isBot) deviceType = "bot";
  else if (/ipad|tablet|playbook|silk/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua)))
    deviceType = "tablet";
  else if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(ua))
    deviceType = "mobile";
  else deviceType = "desktop";

  return { deviceType, browser, os, isBot };
}

/**
 * Best-effort client IP.
 *
 * Behind a proxy (Vercel, Cloudflare, nginx) the socket address is the proxy, so the
 * forwarding headers are the only source. x-forwarded-for may be a comma-separated
 * chain; the left-most entry is the original client.
 *
 * These headers are client-spoofable in principle. That is acceptable here -- the value
 * is coarse analytics context, and nothing is authorised on the basis of it.
 */
export function extractClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    headers.get("x-vercel-forwarded-for") ??
    null
  );
}
