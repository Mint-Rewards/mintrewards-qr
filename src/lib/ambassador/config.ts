/**
 * Mint Ambassador program: batch classification and card layout configuration.
 *
 * Batch year is the year the student's cohort was ADMITTED, not the year they
 * registered. Anyone from a batch before ALUMNUS_CUTOFF_YEAR is an alumnus; that
 * year or later is a current student. This is a business rule the program owner set
 * (see the World Cleanup Day launch), not something derivable from the data, so it
 * lives here as one named constant rather than a magic number scattered through the
 * form, the server action and the CSV export.
 */
export const ALUMNUS_CUTOFF_YEAR = 2026;

export type AmbassadorStatus = "student" | "alumnus";

export function classifyBatch(batchYear: number): AmbassadorStatus {
  return batchYear >= ALUMNUS_CUTOFF_YEAR ? "student" : "alumnus";
}

export const AMBASSADOR_STATUS_LABELS: Record<AmbassadorStatus, string> = {
  student: "Student Ambassador",
  alumnus: "Alumnus Ambassador",
};

/** Batch year options for the registration form, newest first. */
export function batchYearOptions(now: Date = new Date()): number[] {
  const currentYear = now.getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 15; y--) years.push(y);
  return years;
}
