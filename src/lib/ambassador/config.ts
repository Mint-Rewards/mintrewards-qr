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

/**
 * How far the batch dropdown reaches either side of the current year.
 *
 * Six forward covers anyone currently enrolled, including a first-year on a five- or
 * six-year programme such as MBBS. Six back covers the alumni the programme actually
 * wants to reach; older graduates are not the audience, and a longer list is harder to
 * scroll on the phone where this form is filled.
 */
export const BATCH_YEARS_AHEAD = 6;
export const BATCH_YEARS_BACK = 6;

/** Batch year options for the registration form, newest first. */
export function batchYearOptions(now: Date = new Date()): number[] {
  const currentYear = now.getFullYear();
  const years: number[] = [];
  for (let y = currentYear + BATCH_YEARS_AHEAD; y >= currentYear - BATCH_YEARS_BACK; y--) {
    years.push(y);
  }
  return years;
}
