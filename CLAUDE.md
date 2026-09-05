# CLAUDE.md — MintRewards QR Onboarding System

## Project Summary

Build a standalone internal QR code onboarding attribution system for MintRewards.

This is **not** part of an existing MintRewards application. Treat it as a new standalone build using a separate Supabase database.

The system is used by MintRewards admins to generate and assign QR-code standees to on-ground onboarding team members. Those team members place standees in societies, flats, buildings, projects, and events. The QR scans must be attributed back to the team member and assignment/location.

## Core Business Goal

The main goal is attribution, not just QR generation.

The system must help MintRewards answer:

- Which onboarding team member generated how many scans?
- Which assignment/location/campaign performed best?
- Are people scanning iOS or Android more?
- Which standees are active in the field?
- Which onboarding efforts are actually converting later, once signup attribution is connected?

## Important Scope Decisions

### Standalone App

Do not look for or depend on an existing MintRewards codebase.

Build as a standalone internal admin system.

Use Supabase for:

- Auth
- Postgres database
- Storage
- Server-side secure data access where needed

### Existing PDF Template

MintRewards already has a finished PDF standee template:

```text
Mint_Rewards_Standee_Template-English.pdf
```

Do **not** recreate the design.

Do **not** build a drag-and-drop designer.

Do **not** build a new PDF template from scratch.

Instead:

1. Load the provided PDF template.
2. Generate iOS and Android QR codes.
3. Overlay/stamp the QR codes into the existing QR placeholder areas.
4. Save the completed standee as a new PDF.
5. Store/download the generated PDF.

The generated standee should preserve the original PDF design exactly except for the inserted QR codes.

## Recommended Tech Stack

Prefer:

- Next.js
- React
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Tailwind CSS or a simple clean UI framework
- `qrcode` or equivalent for QR generation
- `pdf-lib` or equivalent for stamping QR images onto an existing PDF
- Vitest/Jest/Playwright where appropriate for tests

If choosing a different stack, document why.

## Development Principles

- Keep the app simple, operational, and maintainable.
- Prioritize working attribution flows over visual polish.
- Avoid unnecessary abstractions.
- Keep public QR redirect routes fast.
- Never expose Supabase service role keys to the browser.
- Keep PDF placement coordinates centralized in a config file.
- Make app store URLs and public base URLs configurable through environment variables.
- Write tests for critical logic.
- Document manual verification steps.

## Environment Variables

Use environment variables for deployment-specific values.

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

Rules:

- `SUPABASE_SERVICE_ROLE_KEY` must only be used server-side.
- Public browser code must only use the anon key.
- The public QR base URL must be configurable.
- iOS and Android destination URLs must be configurable.

## Database Tables

Create migrations/schema for these tables.

### `team_members`

Fields:

- `id` UUID primary key
- `full_name` text not null
- `phone` text
- `email` text
- `city` text
- `region` text
- `status` text, active/inactive
- `notes` text
- `created_at` timestamp
- `updated_at` timestamp

### `qr_assignments`

Fields:

- `id` UUID primary key
- `team_member_id` UUID foreign key
- `title` text not null
- `location_name` text
- `location_type` text
- `city` text
- `area` text
- `campaign_start_date` date
- `campaign_end_date` date
- `status` text: draft/active/paused/completed/archived
- `reference_code` text unique
- `notes` text
- `created_by` UUID
- `created_at` timestamp
- `updated_at` timestamp

### `qr_codes`

Fields:

- `id` UUID primary key
- `assignment_id` UUID foreign key
- `team_member_id` UUID foreign key
- `platform` text: ios/android
- `tracking_code` text unique not null
- `tracking_url` text not null
- `destination_url` text not null
- `qr_image_path` text
- `status` text
- `created_at` timestamp
- `updated_at` timestamp

### `qr_scan_events`

Fields:

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

### `generated_standees`

Fields:

- `id` UUID primary key
- `assignment_id` UUID foreign key
- `template_name` text
- `file_path` text
- `file_type` text
- `generated_at` timestamp
- `generated_by` UUID

### Optional Future Table: `attributed_signups`

Create only if useful now, otherwise document for future.

Fields:

- `id` UUID primary key
- `user_id` text or UUID
- `qr_code_id` UUID foreign key
- `assignment_id` UUID foreign key
- `team_member_id` UUID foreign key
- `platform` text
- `signup_at` timestamp
- `attribution_source` text
- `created_at` timestamp

## Row Level Security

Enable RLS where appropriate.

Authenticated admins should be able to read/write admin data.

Public QR routes should not rely on direct public write permissions from the browser. Use a server-side route or Edge Function with secure Supabase access to record scan events.

Do not expose sensitive internals through public QR URLs.

## Required App Areas

Build these screens:

1. Login page
2. Dashboard
3. Team members list
4. Create/edit team member form
5. Assignments list
6. Create/edit assignment form
7. Assignment detail page
8. Team member performance page
9. Standee generation/download action
10. Scan events/reporting view, if time permits

## QR Tracking Behavior

Every assignment must generate two QR codes:

- iOS
- Android

The QR codes should point to public tracking URLs, not directly to app stores.

Example:

```text
/r/ios/:trackingCode
/r/android/:trackingCode
```

On scan:

1. Validate the tracking code.
2. Find the QR code record.
3. Record a scan event with available request metadata.
4. Redirect to the configured app store URL.

If invalid:

- Redirect to a safe fallback page or generic MintRewards download URL.
- Do not show internal errors.

Redirects must be fast. Scan logging should not make the user wait longer than necessary.

## Tracking Codes

Tracking codes must be:

- Unique
- Stable
- Non-guessable
- URL-safe

Do not use raw database IDs as public tracking codes.

## PDF Standee Generation

Use the provided PDF template.

The template already contains the iPhone and Android QR placeholder areas.

Implementation should:

1. Load the base PDF template.
2. Generate QR images for the assignment’s iOS and Android tracking URLs.
3. Stamp the iOS QR code into the iPhone placeholder.
4. Stamp the Android QR code into the Android placeholder.
5. Save the final PDF.
6. Upload/store it in Supabase Storage.
7. Link it to the assignment.
8. Return a download URL to the admin.

Centralize placement config:

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

Calibrate these values against the real PDF coordinate system.

Remember:

- PDF coordinates often use points.
- Origin may be bottom-left.
- The visual render is not necessarily the same coordinate system as the PDF library.
- Leave enough QR quiet-zone margin.
- Test by opening the generated PDF and scanning the QR codes with a phone.

## Main User Flows

### Create Team Member

1. Admin logs in.
2. Admin opens Team Members.
3. Admin creates a team member with name, phone, city, etc.
4. Team member appears in list.

### Create Assignment

1. Admin opens Assignments.
2. Admin creates an assignment.
3. Admin selects team member.
4. Admin enters location/campaign details.
5. System creates assignment.
6. System generates iOS and Android QR code records.
7. System generates unique tracking URLs.

### Generate Standee

1. Admin opens assignment detail.
2. Admin clicks Generate Standee.
3. System loads template PDF.
4. System stamps iOS and Android QR codes into placeholders.
5. System stores generated PDF.
6. Admin can download PDF.

### Scan QR

1. User scans iOS or Android QR.
2. Public redirect route receives tracking code.
3. System records scan event.
4. User is redirected to app store.
5. Dashboard stats update.

## Analytics

Dashboard should show:

- Total active team members
- Total QR assignments
- Active assignments
- Total scans
- iOS scans
- Android scans
- Top-performing team members
- Top-performing assignments/locations
- Recent scans

Assignment detail should show:

- Scan count
- iOS scans
- Android scans
- Recent scans
- QR previews
- Tracking URLs
- Standee download

Team member page should show:

- Total assignments
- Active assignments
- Total scans
- Scans by assignment/location
- Scans by platform

## Exports

If feasible, add CSV export for:

- Team member performance
- Assignment performance
- Scan events

## Testing Requirements

Add automated tests for:

- Team member creation
- Assignment creation
- Tracking code uniqueness
- QR code generation
- Scan event recording
- Correct redirect destination
- Invalid tracking code handling
- Standee generation function
- Dashboard aggregation logic

Manual verification required:

1. Create a team member.
2. Create an assignment.
3. Generate iOS and Android QR codes.
4. Generate standee PDF.
5. Open PDF and confirm QR placement.
6. Scan both QR codes with a real phone.
7. Confirm redirects work.
8. Confirm scan events appear in dashboard.

## Out of Scope for First Version

Do not build unless explicitly requested:

- Drag-and-drop standee designer
- Custom PDF template editor
- Multiple template management
- Existing MintRewards app integration
- Complex install attribution SDK integration
- Print vendor integration
- GPS tracking of onboarding team members

## Future Signup Attribution

First version should fully support scan attribution.

Signup attribution may require changes in the MintRewards mobile app/backend later.

Design the schema so signups can later be linked to:

- QR code
- Assignment
- Team member
- Location/campaign
- Platform

If signup attribution cannot be completed inside this standalone tool, document what must be added to the mobile app/backend later.

## Suggested Build Order

1. Initialize standalone Next.js/TypeScript project.
2. Configure Supabase client/server helpers.
3. Add environment variable validation.
4. Create Supabase schema/migrations.
5. Implement auth/login and route protection.
6. Build team member CRUD.
7. Build assignment CRUD.
8. Generate QR code records and tracking URLs.
9. Implement public QR redirect routes.
10. Implement scan event recording.
11. Build assignment detail stats.
12. Implement PDF template stamping.
13. Store generated standee PDFs.
14. Build dashboard analytics.
15. Add tests.
16. Add documentation.
17. Manually verify PDF + phone QR scanning.

## Quality Bar

The task is not complete until:

- The app runs locally.
- Supabase schema is present.
- Core flows work end-to-end.
- Generated QR codes scan correctly.
- Generated standee PDF uses the provided template.
- Scan events are actually recorded.
- Dashboard stats reflect real scan data.
- Tests pass or any test limitations are clearly documented.

## Final Reminder

Do not spend time rebuilding the standee design. The PDF exists already. The product value is in assignment, attribution, scan tracking, analytics, and producing printable PDFs with the right QR codes stamped in the right places.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
