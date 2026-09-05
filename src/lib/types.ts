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

export function labelFor(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}
