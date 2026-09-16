import { describe, it, expect } from "vitest";
import { formatDateTime, formatDate } from "@/lib/format";

/**
 * These run in whatever timezone the machine happens to be in, which is the point:
 * the output must not depend on it. Every timestamp is rendered by a Server Component,
 * so an unpinned formatter silently produces UTC in production while looking correct
 * on a developer's machine in Karachi.
 *
 * Month spelling is matched loosely -- ICU renders September as "Sep" or "Sept"
 * depending on the Node build, and pinning that would make the suite fail on an
 * upgrade for no reason.
 */
describe("admin date formatting", () => {
  // 05:50 UTC is 10:50 in Karachi (UTC+5).
  const utcMorning = "2026-09-16T05:50:44.000Z";

  it("shifts a UTC timestamp into Pakistan time", () => {
    const formatted = formatDateTime(utcMorning);

    expect(formatted).toContain("10:50");
    expect(formatted).not.toContain("05:50");
    expect(formatted).toMatch(/^16 Sept? 2026/);
  });

  it("rolls the date over when UTC and Pakistan disagree on the day", () => {
    // 20:30 UTC on the 16th is 01:30 on the 17th in Karachi.
    const formatted = formatDateTime("2026-09-16T20:30:00.000Z");

    expect(formatted).toMatch(/^17 Sept? 2026/);
    expect(formatted).toContain("01:30");
  });

  it("puts the day before the month, so 9/16 cannot be misread", () => {
    expect(formatDate(utcMorning)).toMatch(/^16 Sept? 2026$/);
  });

  it("accepts a Date as readily as an ISO string", () => {
    expect(formatDateTime(new Date(utcMorning))).toBe(formatDateTime(utcMorning));
  });
});
