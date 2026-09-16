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

/**
 * Spreadsheet format: "2026-09-16 15:50", Pakistan time.
 *
 * Deliberately NOT the display format. "16 Sept 2026, 03:50 pm" is pleasant to read
 * and useless in a spreadsheet -- Excel treats it as text, so the column will not sort
 * chronologically and cannot be filtered by date. Year-first with a 24-hour clock is
 * parsed as a real datetime and sorts correctly even when it is not.
 *
 * The zone is carried by the column HEADER rather than the value, since a suffix on
 * every cell would break that parsing again.
 */
const exportParts = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  // h23 rather than hour12:false: the latter renders midnight as "24" in some locales.
  hourCycle: "h23",
  timeZone: TIME_ZONE,
});

export function formatDateTimeForExport(value: string | Date | null | undefined): string {
  // Blank rather than "Invalid Date" -- an empty cell is what a spreadsheet expects
  // for a scan that never happened.
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = exportParts.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
