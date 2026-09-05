/**
 * Minimal RFC 4180 CSV serialisation.
 *
 * Escaping matters here more than usual: location names and notes routinely contain
 * commas ("DHA Phase 5, Gate 2") and quotes, and an unescaped field silently shifts
 * every column after it.
 */
export function toCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; header: string }[],
): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    // Leading =, +, -, @ are interpreted as formulas by Excel/Sheets. Prefix with a
    // single quote so exported data cannot execute on open.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };

  const header = columns.map((c) => escape(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escape(r[c.key])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function stamped(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}
