# MintRewards QR Onboarding Attribution System — Task Description

## Overview

Build a standalone QR code onboarding attribution system for MintRewards.

This is a standalone internal tool. Do **not** assume there is an existing MintRewards codebase to integrate with.

Use a separate Supabase project/database for this system.

The system is for MintRewards’ on-ground onboarding team. Team members visit locations like societies, flats, apartment buildings, commercial projects, and events. They place physical MintRewards standees containing iOS and Android QR codes. Each standee must be assigned to a specific onboarding team member and optionally a specific location/campaign, so MintRewards can track onboarding activity and performance.

## Important Template Requirement

MintRewards already has a finished printable standee design as a PDF template.

Do **not** build a PDF template designer.

Do **not** recreate the standee layout from scratch.

The system should use the provided PDF template and programmatically insert the generated iOS and Android QR codes into the existing QR placeholder areas.

Template file:

```text
Mint_Rewards_Standee_Template-English.pdf
```

The template already includes:

- Mint Rewards branding
- Headline and marketing copy
- How it works section
- Download the App section
- iPhone QR placeholder
- Android QR placeholder
- Footer branding

The system should preserve the original PDF exactly and only overlay/replace the QR placeholder areas with generated QR codes.

## Primary Goal

Create a standalone internal admin system that allows MintRewards admins to:

- Create onboarding team members
- Assign QR code sets to team members
- Generate unique iOS and Android tracking QR codes
- Produce printable standee PDFs using the existing PDF template
- Track scans and onboarding performance by team member, assignment, location, and platform

## Recommended Stack

Use a standalone modern web app with:

- Frontend: Next.js + React
- Backend/API: Next.js API routes or Supabase Edge Functions
- Database: Supabase Postgres
- Auth: Supabase Auth
- File storage: Supabase Storage
- QR generation: QR code generation library
- PDF stamping: PDF manipulation library that can overlay images onto an existing PDF

Use Supabase for:

- Admin authentication
- Database tables
- Row-level security where appropriate
- Storage for generated QR images and generated standee PDFs

## Core Requirements

### 1. Admin Authentication

The system should require login for all admin pages.

Use Supabase Auth.

Only authenticated admins should be able to:

- Manage team members
- Create assignments
- Generate QR codes
- Download standees
- View analytics
- Export reports

Public QR scan routes should not require authentication.

### 2. Team Member Management

Build an admin interface where MintRewards admins can:

- Create onboarding team members
- Edit onboarding team member details
- Deactivate team members
- View all team members
- Search/filter team members

Each team member should include:

- `id`
- `full_name`
- `phone`
- `email`, optional
- `city`
- `region`, optional
- `status`: active/inactive
- `notes`, optional
- `created_at`
- `updated_at`

### 3. QR Assignment Management

Admins should be able to create QR assignments.

An assignment represents one physical standee or one batch of standees assigned to a team member.

Each assignment should include:

- `id`
- assigned team member
- assignment title
- location name, optional
- location type, optional:
  - Society
  - Flats
  - Project
  - Event
  - Mall
  - Other
- city
- area, optional
- campaign start date, optional
- campaign end date, optional
- status:
  - Draft
  - Active
  - Paused
  - Completed
  - Archived
- notes
- internal reference code
- created_by
- created_at
- updated_at

Example locations:

- DHA Phase 5 Flats
- Bahria Town Society Gate 2

### 4. QR Code Generation

For every assignment, automatically generate two QR codes:

- iOS QR code
- Android QR code

Each QR code should point to a trackable URL, not directly to the App Store or Play Store.

Example routes:

```text
https://qr.mintrewards.app/r/ios/{trackingCode}
https://qr.mintrewards.app/r/android/{trackingCode}
```

Or if using the main app domain:

```text
https://mintrewards.app/r/ios/{trackingCode}
https://mintrewards.app/r/android/{trackingCode}
```

The exact public base URL should be configurable.

Each QR code should store:

- `id`
- `assignment_id`
- `team_member_id`
- `platform`: ios/android
- `tracking_code`
- `tracking_url`
- `destination_url`
- `qr_image_path`, if stored
- `status`
- `created_at`
- `updated_at`

Tracking codes should be:

- Unique
- Non-guessable
- URL-safe
- Stable once generated

Do not expose internal database IDs in the public QR URL.

### 5. QR Scan Redirect Behavior

Implement public scan routes:

```text
/r/ios/:trackingCode
/r/android/:trackingCode
```

When scanned:

1. Validate the tracking code.
2. Record a scan event.
3. Identify:
   - QR code
   - Assignment
   - Team member
   - Platform
4. Capture available metadata:
   - scanned_at
   - user agent
   - IP address, if available
   - referrer, if available
   - device/browser/OS info if easy to parse
5. Redirect the user to the correct destination:
   - iOS App Store URL for iOS QR
   - Android Play Store URL for Android QR

If the tracking code is invalid:

- Redirect to a safe fallback URL, such as a generic MintRewards download page
- Do not expose an internal error to the public user

Important behavior:

- Redirect must be fast
- Analytics recording should not block the redirect if there is a temporary logging failure
- Public scan routes should not require login

### 6. Standee PDF Generation Using Existing Template

Use the provided existing PDF template.

The system should not recreate the design.

The system should generate a new standee PDF for each assignment by placing the generated QR codes into the existing iPhone and Android placeholder areas.

The template has two QR placeholder boxes:

- iPhone QR placeholder on the left card in the “Download the App” section
- Android QR placeholder on the right card in the “Download the App” section

Implementation requirements:

1. Load the base PDF template.
2. Generate the iOS QR image.
3. Generate the Android QR image.
4. Overlay the iOS QR image into the iPhone placeholder box.
5. Overlay the Android QR image into the Android placeholder box.
6. Save the completed PDF as a generated standee.
7. Store the generated PDF in Supabase Storage.
8. Link the generated PDF to the assignment.

The generated PDF should preserve:

- Original template dimensions
- Original branding
- Original colors
- Original text
- Original layout
- Print quality

The generated PDF should only change:

- iPhone QR placeholder replaced with actual iOS QR code
- Android QR placeholder replaced with actual Android QR code
- Optional small internal reference code if needed, but only if it does not interfere with the design

Do not add a new standee builder UI in the first version.

Instead, create a simple **Generate Standee** / **Download Standee** button on the assignment detail page.

### 7. QR Placement Calibration

The implementation should define the QR placement coordinates in a config file or constants file.

Do not hardcode them randomly throughout the codebase.

Example:

```ts
export const STANDEE_TEMPLATE_CONFIG = {
  templateName: "Mint_Rewards_Standee_Template-English.pdf",
  page: 0,
  iosQrBox: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
  androidQrBox: {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  },
};
```

The coordinates must be calibrated against the actual PDF coordinate system.

Important:

- PDF coordinates usually use points, not pixels.
- The origin may be bottom-left depending on the PDF library.
- The rendered template preview shows the QR placeholders near the lower blue section.
- Make sure the QR codes are centered inside the placeholder boxes.
- Leave enough quiet zone/margin around QR codes so phones can scan them.
- Generated QR codes must be tested visually and by scanning.

The system should include a developer utility or preview mode to help verify QR placement.

### 8. Supabase Database Schema

Create Supabase tables for the following entities.

#### `team_members`

- `id` UUID primary key
- `full_name` text not null
- `phone` text
- `email` text
- `city` text
- `region` text
- `status` text
- `notes` text
- `created_at` timestamp
- `updated_at` timestamp

#### `qr_assignments`

- `id` UUID primary key
- `team_member_id` UUID foreign key
- `title` text not null
- `location_name` text
- `location_type` text
- `city` text
- `area` text
- `campaign_start_date` date
- `campaign_end_date` date
- `status` text
- `reference_code` text unique
- `notes` text
- `created_by` UUID
- `created_at` timestamp
- `updated_at` timestamp

#### `qr_codes`

- `id` UUID primary key
- `assignment_id` UUID foreign key
- `team_member_id` UUID foreign key
- `platform` text check: ios/android
- `tracking_code` text unique not null
- `tracking_url` text not null
- `destination_url` text not null
- `qr_image_path` text
- `status` text
- `created_at` timestamp
- `updated_at` timestamp

#### `qr_scan_events`

- `id` UUID primary key
- `qr_code_id` UUID foreign key
- `assignment_id` UUID foreign key
- `team_member_id` UUID foreign key
- `platform` text
- `scanned_at` timestamp
- `ip_address` text
- `user_agent` text
- `referrer` text
- `device_type` text
- `browser` text
- `os` text
- `redirected_to` text

#### `generated_standees`

- `id` UUID primary key
- `assignment_id` UUID foreign key
- `template_name` text
- `file_path` text
- `file_type` text, usually pdf
- `generated_at` timestamp
- `generated_by` UUID

#### Optional Future Table: `attributed_signups`

- `id` UUID primary key
- `user_id` text or UUID
- `qr_code_id` UUID foreign key
- `assignment_id` UUID foreign key
- `team_member_id` UUID foreign key
- `platform` text
- `signup_at` timestamp
- `attribution_source` text
- `created_at` timestamp

### 9. Supabase Row Level Security

Enable RLS where appropriate.

Admin tables should only be readable/writable by authenticated admin users.

Public QR scan routes need controlled write access to scan events.

Recommended approach:

- Use server-side Supabase service role key only in secure backend/Edge Function contexts
- Do not expose service role key to the browser
- Browser/admin client uses normal authenticated Supabase client
- Public redirect route should run server-side and write scan events securely

### 10. Admin Dashboard

Create an admin dashboard showing:

- Total active team members
- Total QR assignments
- Active assignments
- Total scans
- iOS scans
- Android scans
- Top-performing team members
- Top-performing assignments/locations
- Recent scans
- Recent generated standees

Filters:

- Date range
- Team member
- City
- Location type
- Assignment status
- Platform

### 11. Assignment Detail Page

Each assignment should have a detail page showing:

- Assignment title
- Assigned team member
- Location/campaign details
- Assignment status
- Internal reference code
- iOS QR preview
- Android QR preview
- iOS tracking URL
- Android tracking URL
- Generate/regenerate standee button
- Download standee button
- Scan stats
- Recent scan events

### 12. Team Member Performance Page

Each team member should have a performance page showing:

- Total assignments
- Active assignments
- Total scans
- iOS scans
- Android scans
- Scans by assignment/location
- Recent activity
- Date range filter

### 13. Reporting/Export

Add CSV export if feasible.

Reports:

- Team member performance
- Assignment performance
- Scan events

CSV columns should include:

- Team member
- Assignment
- Location
- City
- Platform
- Scan count
- Date range
- Status

### 14. Configuration

Make these configurable through environment variables:

```env
NEXT_PUBLIC_APP_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

IOS_APP_STORE_URL=
ANDROID_PLAY_STORE_URL=
QR_PUBLIC_BASE_URL=

STANDEE_TEMPLATE_STORAGE_PATH=
GENERATED_STANDEES_BUCKET=
QR_IMAGES_BUCKET=
```

If using Supabase Storage for the base template:

- Store the template PDF in a protected/admin storage bucket
- Load it server-side during standee generation

If keeping the template in the repository:

- Put it somewhere like `/templates/Mint_Rewards_Standee_Template-English.pdf`
- Document how to replace/update it

### 15. UI Screens

Build these screens:

- Login page
- Dashboard
- Team members list
- Create/edit team member
- Assignments list
- Create/edit assignment
- Assignment detail
- Team member performance
- Standee preview/download page, optional
- Scan events table/export page, optional

The UI can be simple and internal-facing.

Prioritize operational clarity over visual complexity.

### 16. Standee Generation Flow

When admin creates an assignment:

1. Create assignment record.
2. Generate unique reference code.
3. Generate iOS tracking code.
4. Generate Android tracking code.
5. Create QR code records.
6. Generate QR images.
7. Optionally generate standee immediately, or let admin click **Generate Standee**.

When admin clicks **Generate Standee**:

1. Fetch assignment.
2. Fetch related iOS and Android QR code records.
3. Generate QR images if missing.
4. Load the existing PDF template.
5. Overlay the iOS QR into the iPhone placeholder.
6. Overlay the Android QR into the Android placeholder.
7. Save final PDF.
8. Upload final PDF to Supabase Storage.
9. Create/update generated standee record.
10. Return download URL.

### 17. Acceptance Criteria

The feature is complete when:

- Admin can log in
- Admin can create an onboarding team member
- Admin can create a QR assignment for that team member
- System creates separate iOS and Android tracking QR codes
- Each QR code has a unique tracking URL
- Scanning iOS QR records a scan and redirects to the iOS App Store URL
- Scanning Android QR records a scan and redirects to the Android Play Store URL
- Admin can generate a completed standee PDF using the provided PDF template
- Generated PDF preserves the original standee design
- Generated PDF places the correct QR codes into the correct placeholder boxes
- QR codes inside the generated PDF are scannable from a phone
- Assignment detail page shows QR previews, tracking URLs, standee download, and scan stats
- Dashboard shows aggregate scan activity
- Team member performance can be viewed
- Invalid tracking codes redirect safely
- Supabase database schema and RLS policies are included
- Tests cover the core logic
- Documentation explains setup, Supabase config, QR tracking, and standee generation

### 18. Testing Requirements

Add tests for:

- Creating team members
- Creating assignments
- Generating unique tracking codes
- Creating iOS and Android QR codes
- Recording scan events
- Redirecting to correct platform destination
- Invalid tracking code behavior
- Dashboard analytics aggregation
- Standee generation function
- Supabase permission/RLS assumptions where practical

Manual verification:

- Generate one assignment
- Download the standee PDF
- Open the PDF and visually confirm QR placement
- Scan the iPhone QR with a phone
- Scan the Android QR with a phone
- Confirm both redirect correctly
- Confirm scan events are recorded
- Confirm dashboard stats update

### 19. Out of Scope for First Version

Do not build these unless explicitly needed:

- Full custom standee designer
- Drag-and-drop PDF editor
- Multiple marketing templates
- Complex mobile install attribution SDK integration
- Existing MintRewards app integration
- Automated print vendor integration
- Real-time GPS tracking of team members

### 20. Future Extension: Signup Attribution

The first version can track scans reliably.

Signup/install attribution depends on the MintRewards mobile app and backend.

Prepare the database and tracking structure so that later, when the MintRewards app supports referral/deep-link attribution, a signup can be linked back to:

- QR code
- Assignment
- Team member
- Location/campaign
- Platform

For now, implement scan attribution fully and document what would be needed to connect app signups later.

### 21. Build Order

Implement in this order:

1. Set up standalone project.
2. Set up Supabase connection.
3. Create database schema and migrations.
4. Implement Supabase Auth/admin protection.
5. Build team member CRUD.
6. Build assignment CRUD.
7. Implement QR code generation.
8. Implement public QR redirect tracking routes.
9. Implement scan analytics.
10. Implement PDF standee stamping using the provided template.
11. Build dashboard and detail pages.
12. Add tests.
13. Add documentation.
14. Manually verify QR scans and PDF output.

## Key Instruction

Do not recreate the standee design. Use the existing PDF template and stamp QR codes into the iPhone and Android placeholder areas. The value of this system is attribution and operational tracking, not design generation.
