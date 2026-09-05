import { describe, it, expect } from "vitest";
import { parseUserAgent, extractClientIp } from "@/lib/user-agent";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/604.1";
const WHATSAPP = "WhatsApp/2.23.20.0 A";
const DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

describe("parseUserAgent", () => {
  it("identifies iPhone scans", () => {
    const r = parseUserAgent(IPHONE);
    expect(r.os).toBe("ios");
    expect(r.deviceType).toBe("mobile");
    expect(r.browser).toBe("Safari");
    expect(r.isBot).toBe(false);
  });

  it("identifies Android scans", () => {
    const r = parseUserAgent(ANDROID);
    expect(r.os).toBe("android");
    expect(r.deviceType).toBe("mobile");
    expect(r.browser).toBe("Chrome");
  });

  it("treats iPad as iOS tablet", () => {
    const r = parseUserAgent(IPAD);
    // iPadOS reports "Macintosh"-like strings; the ipad token must win.
    expect(r.os).toBe("ios");
    expect(r.deviceType).toBe("tablet");
  });

  it("flags link-preview fetchers as bots", () => {
    // These hit tracking URLs whenever a link is pasted into a chat. Counting them as
    // real scans would inflate every team member's numbers.
    const r = parseUserAgent(WHATSAPP);
    expect(r.isBot).toBe(true);
    expect(r.deviceType).toBe("bot");
  });

  it("does not misread desktop Chrome as a bot", () => {
    const r = parseUserAgent(DESKTOP);
    expect(r.isBot).toBe(false);
    expect(r.os).toBe("macos");
    expect(r.deviceType).toBe("desktop");
  });

  it("handles a missing user agent without throwing", () => {
    const r = parseUserAgent(null);
    expect(r.deviceType).toBe("unknown");
    expect(r.isBot).toBe(false);
  });
});

describe("extractClientIp", () => {
  it("takes the left-most address from a forwarding chain", () => {
    // The client is left-most; everything after it is proxy hops.
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 70.41.3.18, 150.172.238.178" });
    expect(extractClientIp(h)).toBe("203.0.113.9");
  });

  it("falls back through the other proxy headers", () => {
    expect(extractClientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
    expect(extractClientIp(new Headers({ "cf-connecting-ip": "198.51.100.5" }))).toBe("198.51.100.5");
  });

  it("returns null when no proxy header is present", () => {
    expect(extractClientIp(new Headers())).toBeNull();
  });
});
