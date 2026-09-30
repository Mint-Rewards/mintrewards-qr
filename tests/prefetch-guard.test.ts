import { describe, it, expect } from "vitest";
import { isPrefetchRequest } from "@/lib/user-agent";

/**
 * Regression guard.
 *
 * The admin UI is served from the same origin as the tracking URLs, so a `next/link`
 * pointing at /r/... is an internal route that Next prefetches on render. Before this
 * guard, opening an assignment page fired a prefetch for both QR links and inflated that
 * assignment's own scan count by 2 on every single reload.
 */
describe("isPrefetchRequest", () => {
  const h = (o: Record<string, string>) => new Headers(o);

  it("detects Next.js router prefetches", () => {
    expect(isPrefetchRequest(h({ "next-router-prefetch": "1" }))).toBe(true);
    expect(isPrefetchRequest(h({ "x-middleware-prefetch": "1" }))).toBe(true);
    expect(isPrefetchRequest(h({ rsc: "1" }))).toBe(true);
  });

  it("detects browser speculation hints", () => {
    expect(isPrefetchRequest(h({ "sec-purpose": "prefetch" }))).toBe(true);
    expect(isPrefetchRequest(h({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isPrefetchRequest(h({ purpose: "prefetch" }))).toBe(true);
    expect(isPrefetchRequest(h({ "x-purpose": "prefetch" }))).toBe(true);
    expect(isPrefetchRequest(h({ "x-moz": "prefetch" }))).toBe(true);
  });

  it("does NOT flag a real scan from a phone", () => {
    // The whole point: a genuine scan must still be counted.
    expect(
      isPrefetchRequest(
        h({
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1",
          accept: "text/html",
        }),
      ),
    ).toBe(false);
    expect(isPrefetchRequest(h({}))).toBe(false);
  });

  it("is case-insensitive on the header value", () => {
    expect(isPrefetchRequest(h({ purpose: "PREFETCH" }))).toBe(true);
  });
});
