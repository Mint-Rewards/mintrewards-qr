/**
 * Date formatting for the admin screens.
 *
 * Every timestamp in this app is rendered by a Server Component, so a bare
 * `toLocaleString()` formats in the SERVER's timezone -- UTC on Vercel. That reads
 * correctly on a developer's machine in Karachi and is five hours wrong in production,
 * which is exactly the kind of bug that survives review.
 *
 * Pinning the zone also means the team sees one consistent clock wherever they happen
 * to be, rather than a scan being timestamped differently depending on who opens the
 * page.
 */
const TIME_ZONE = "Asia/Karachi";

/**
 * Day-month-year on purpose. The previous default rendered "9/16/2026", which a
 * Pakistani reader parses as the 9th of month 16 before realising it is US ordering.
 */
const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: TIME_ZONE,
});

const dateOnly = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

/** e.g. "16 Sep 2026, 03:50 pm" — always Pakistan time. */
export function formatDateTime(value: string | Date): string {
  return dateTime.format(new Date(value));
}

/** e.g. "16 Sep 2026" — always Pakistan time. */
export function formatDate(value: string | Date): string {
  return dateOnly.format(new Date(value));
}
