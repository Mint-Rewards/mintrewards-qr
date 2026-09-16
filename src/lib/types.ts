/** Shared domain types and the option lists the forms and filters render from. */

export type Platform = "ios" | "android";
export type MemberStatus = "active" | "inactive";
export type AssignmentStatus =
  | "draft" | "active" | "paused" | "completed" | "archived";

/** Must stay in step with the CHECK constraint in 0001_init.sql. */
export const LOCATION_TYPES = [
  { value: "society", label: "Society" },
  { value: "flats",   label: "Flats" },
  { value: "project", label: "Project" },
  { value: "event",   label: "Event" },
  { value: "mall",    label: "Mall" },
  { value: "other",   label: "Other" },
] as const;

export const ASSIGNMENT_STATUSES = [
  { value: "draft",     label: "Draft" },
  { value: "active",    label: "Active" },
  { value: "paused",    label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived",  label: "Archived" },
] as const;

export const MEMBER_STATUSES = [
  { value: "active",   label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

export interface TeamMember {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  region: string | null;
  status: MemberStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface QrAssignment {
  id: string;
  team_member_id: string;
  title: string;
  location_name: string | null;
  location_type: string | null;
  city: string | null;
  area: string | null;
  campaign_start_date: string | null;
  campaign_end_date: string | null;
  status: AssignmentStatus;
  reference_code: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QrCode {
  id: string;
  assignment_id: string;
  team_member_id: string;
  platform: Platform;
  tracking_code: string;
  tracking_url: string;
  destination_url: string;
  qr_image_path: string | null;
  status: string;
  created_at: string;
}

export interface ScanEvent {
  id: string;
  qr_code_id: string;
  assignment_id: string;
  team_member_id: string;
  platform: Platform;
  scanned_at: string;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  redirected_to: string | null;
  is_bot: boolean;
}

export interface AssignmentPerformance {
  assignment_id: string;
  title: string;
  reference_code: string;
  location_name: string | null;
  location_type: string | null;
  city: string | null;
  area: string | null;
  status: AssignmentStatus;
  team_member_id: string;
  team_member_name: string;
  total_scans: number;
  ios_scans: number;
  android_scans: number;
  scans_last_7d: number;
  last_scan_at: string | null;
  created_at: string;
}

export interface TeamMemberPerformance {
  team_member_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  region: string | null;
  status: MemberStatus;
  total_assignments: number;
  active_assignments: number;
  total_scans: number;
  ios_scans: number;
  android_scans: number;
  scans_last_7d: number;
  last_scan_at: string | null;
}

// ---------------------------------------------------------------------------
// Mint Ambassador program
// ---------------------------------------------------------------------------

export type AmbassadorCampaignStatus =
  | "draft" | "active" | "paused" | "completed" | "archived";
export type AmbassadorStatus = "student" | "alumnus";

/** Must stay in step with the CHECK constraint in 0004_ambassadors.sql. */
export const AMBASSADOR_CAMPAIGN_STATUSES = [
  { value: "draft",     label: "Draft" },
  { value: "active",    label: "Active" },
  { value: "paused",    label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "archived",  label: "Archived" },
] as const;

export interface AmbassadorCampaign {
  id: string;
  title: string;
  event_name: string | null;
  event_date: string | null;
  location_name: string | null;
  city: string | null;
  status: AmbassadorCampaignStatus;
  tracking_code: string;
  tracking_url: string;
  reference_code: string;
  qr_image_path: string | null;
  share_caption: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface University {
  id: string;
  name: string;
  sector: "public" | "private";
  city: string | null;
  is_active: boolean;
}

/** The value the form submits when a student's campus is not on the list. */
export const UNIVERSITY_OTHER = "other";

export interface MintAmbassador {
  id: string;
  campaign_id: string;
  full_name: string;
  /** Null on the rows that predate contact collection. */
  email: string | null;
  phone: string | null;
  university: string;
  /** Null when the student chose "Other" and typed their campus in. */
  university_id: string | null;
  batch_year: number;
  ambassador_status: AmbassadorStatus;
  card_file_path: string | null;
  created_at: string;
}

export interface AmbassadorCampaignPerformance {
  campaign_id: string;
  title: string;
  reference_code: string;
  event_name: string | null;
  event_date: string | null;
  location_name: string | null;
  city: string | null;
  status: AmbassadorCampaignStatus;
  total_views: number;
  total_registrations: number;
  student_count: number;
  alumnus_count: number;
  conversion_pct: number | null;
  last_registration_at: string | null;
  created_at: string;
}

export function labelFor(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}
