# MintRewards QR — Implementation Plan

**Status:** built and verified against a live Supabase project (2026-09-06).
See README.md for setup and operational docs.
**Scope decision:** English standee template only for v1. Config is keyed by language so
the Urdu template drops in later without restructuring.

---

## 1. Stack & rationale

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Base UI) ·
Supabase (Auth / Postgres / Storage) · `qrcode` · `pdf-lib` · Vitest.

Built on Next 16 rather than 15 (current release at scaffold time); `after()` is stable in
both. **Node 22+ is required** — `@supabase/supabase-js` needs a native WebSocket, absent
in Node 20, where the admin client throws inside the redirect route.

This matches the spec's preferred stack, so there are no deviations to justify. Two choices
worth recording:

- **`after()`** for scan logging. It is the purpose-built primitive for "respond
  now, do work afterwards", which is exactly what the redirect path requires.
- **shadcn/ui** for the admin panel. Components are copied into the repo rather than
  installed as a dependency, so there is no version drift and the UI stays editable.

---

## 2. File layout

```
src/
  app/
    (auth)/login/page.tsx
    (admin)/
      layout.tsx                    # session guard + app shell
      dashboard/page.tsx
      team-members/page.tsx | new | [id]/edit | [id]/page.tsx   # [id] = performance
      assignments/page.tsx  | new | [id]/edit | [id]/page.tsx   # [id] = detail
      scans/page.tsx
    r/[platform]/[code]/route.ts    # PUBLIC redirect — no auth
    api/
      assignments/[id]/standee/route.ts
      export/{team-members,assignments,scans}/route.ts
    dev/standee-preview/route.ts    # spec §7 calibration utility
  components/ui/                    # shadcn primitives
  lib/
    supabase/{browser,server,admin}.ts
    env.ts                          # zod validation, fails fast at boot
    tracking-code.ts
    qr.ts
    standee/{config.ts,generate.ts}
    user-agent.ts
supabase/migrations/000{1..4}_*.sql
templates/Mint_Rewards_Standee_English.pdf
tests/
```

Three Supabase clients, physically separated so the service-role key can never be pulled
into a client bundle:

| Client | Key | Used from |
|---|---|---|
| `browser.ts` | anon | client components |
| `server.ts` | anon + user session cookie | server components, admin routes |
| `admin.ts` | **service role**, marked `import 'server-only'` | redirect + standee routes only |

---

## 3. Tracking-code scheme

12 characters from a 32-character alphabet that excludes look-alikes (`0/O`, `1/I/l`),
drawn from `crypto.randomBytes` using rejection sampling to avoid modulo bias.
**60 bits of entropy** — unguessable by brute force, and no database ID is ever exposed.

Uniqueness is guaranteed by a `UNIQUE` constraint on `qr_codes.tracking_code`, *not* by a
pre-flight existence check. Generate, insert, and on a `23505` conflict retry (max 5
attempts). A pre-check is racy; the constraint is the real guarantee.

**Length is load-bearing.** `https://qr.mintrewards.app/r/ios/<12>` is ~45 characters,
which yields a **version-3 QR at EC level M**. That keeps modules coarse and reliably
scannable at the 210 pt box. Longer codes push the QR version up, shrink each module, and
cost real scan reliability on a printed standee.

---

## 4. Database schema

All tables from the spec, plus these operational additions:

- **Indexes** — `qr_codes.tracking_code` (unique; the redirect hot path), and
  `qr_scan_events` on `(qr_code_id, scanned_at)`, `(team_member_id, scanned_at)`,
  `(assignment_id, scanned_at)` to keep dashboard rollups fast as scan volume grows.
- **Constraints** — `CHECK` on `platform IN ('ios','android')` and on the status enums;
  `ON DELETE RESTRICT` for team members that still have assignments.
- **Denormalized `team_member_id`** on `qr_codes` and `qr_scan_events` (as the spec
  specifies). Redundant via the assignment, but it makes per-member analytics
  single-table. Kept correct by a database trigger rather than application code.
- **Views** — `v_team_member_performance`, `v_assignment_performance`,
  `v_dashboard_totals`. Aggregation lives in SQL, so it is both fast and directly testable.
- **`updated_at`** triggers on every mutable table.
- **`attributed_signups`** — created now, empty and unused. It costs nothing today and
  means the future mobile-app work is a write, not a migration.

### Row Level Security

Enabled on every table.

- Admin tables: readable/writable by `authenticated` only.
- `qr_scan_events`: **no client-side insert policy at all.** Writes come solely from the
  server via the service role, so a leaked anon key cannot poison analytics.
- Public signup disabled in Supabase; every authenticated user is an admin (this is an
  internal, invite-only tool). Documented explicitly, with an allowlist table as the
  noted upgrade path.

---

## 5. Redirect route — the critical path

`GET /r/[platform]/[code]`:

1. Validate shape, look up by indexed `tracking_code`.
2. **Redirect immediately** (302, `Cache-Control: no-store`).
3. Log the scan inside `after()` — never blocking. Failures are swallowed, never surfaced.
4. Invalid or unknown code → 302 to the configured fallback URL. No error page, no
   internal detail leaked.

Three things that are easy to get wrong:

- **`no-store` is load-bearing.** A cached redirect is a silently lost scan event, and the
  bug stays invisible until the analytics look wrong.
- **Destination comes from the QR's platform, never from UA sniffing.** The detected OS is
  still recorded, and mismatches are flagged — "scanned the Android code on an iPhone" is
  genuine field signal about standee layout.
- **Bot filtering.** Link-preview fetchers (WhatsApp, iMessage, Slack) hit these URLs and
  would inflate scan counts. Known bot user-agents are *flagged, not dropped*, so the
  number stays honest and auditable.

---

## 6. Standee generation

Coordinates below were confirmed by measuring the actual template, not estimated.
Verified by stamping, rasterizing, and machine-decoding the result.

```ts
export const STANDEE_TEMPLATES = {
  english: {
    templateName: "Mint_Rewards_Standee_English.pdf",
    page: 0,
    pageSize: { width: 864, height: 2160 },
    iosQrBox:     { x: 132, y: 212, width: 210, height: 210 },
    androidQrBox: { x: 522, y: 212, width: 210, height: 210 },
  },
  // urdu: MIRRORED — ios RIGHT (x 522), android LEFT (x 132), y = 229.
  // Measured and verified 2026-09-05; not yet wired up. See §9.
} as const;
```

`POST /api/assignments/[id]/standee`:

1. Load the template from `templates/` (path via env; Storage alternative documented).
2. Generate both QR images.
3. Stamp iOS and Android into their boxes.
4. Upload to a **private** `generated-standees` bucket.
5. Upsert the `generated_standees` row.
6. Return a short-lived **signed URL**.

Private plus signed, not public — standee PDFs are internal artifacts.

`/dev/standee-preview` satisfies spec §7: renders a standee with dummy codes and overlays
the config's box outlines, so any future recalibration is visual and immediate.

---

## 7. Admin UI principles

The operator runs this while standing in an office coordinating field staff. The layout is
built for speed, not for browsing:

- **Persistent sidebar** — Dashboard, Team Members, Assignments, Scans. Never more than
  one click from anywhere.
- **The assignment detail page is the workhorse.** Both QR previews, both tracking URLs
  with one-click copy, Generate/Regenerate Standee, Download, and scan stats all on one
  screen with no tabs.
- **Create flows are single-page forms**, not wizards. Creating an assignment produces the
  reference code and both QR codes in one submit.
- **Every list has search and filters** and shows scan counts inline, so the useful number
  is visible without drilling in.
- Tables, empty states, and loading skeletons are consistent across all four sections.

---

## 8. Test strategy

Vitest. The highest-value test is the standee one: **generate a PDF, rasterize it, and
decode the QR codes back out**, asserting the iOS payload sits in the iPhone box and the
Android payload in the Android box. That harness has already been built and run — it is
what caught the Urdu mirroring — so it folds straight in. A coordinate typo or a swapped
platform then fails CI instead of reaching a print shop.

Alongside it:

- tracking-code uniqueness, entropy, and charset
- redirect destination correctness per platform
- invalid tracking code → safe fallback
- scan event recording, including the non-blocking path
- user-agent parsing
- aggregation correctness (seed known scans, assert view output)

Supabase-touching tests run against a local `supabase start` instance. If Docker is
unavailable, they mock at the client boundary and the gap is documented rather than
quietly skipped.

---

## 9. Build order

1. Env validation and Supabase clients
2. Migrations and RLS
3. Auth and route protection
4. Team member CRUD
5. Assignment CRUD + QR record generation
6. **Public redirect + scan logging**
7. Standee stamping
8. Dashboard, assignment detail, team member performance
9. CSV exports
10. Tests
11. Documentation

Redirect and standee generation come before the analytics UI deliberately. They are the
two pieces with real unknowns and physical-world consequences, and everything downstream
is only as good as the data they produce.

---

## 10. Known context and open items

### The Urdu template is mirrored

A second template exists (`Mint Rewards Standee Template.pdf`, Urdu). It is **RTL-mirrored:
iOS is on the RIGHT, Android on the LEFT** — the reverse of English — and its placeholder
boxes sit 17 pt higher. Assuming "left = iOS" would send every iPhone user to the Play
Store, and the error is invisible without decoding the output.

Out of scope for v1, but the measurements are recorded in §6 so they never need to be
rediscovered. Adding it later is one object literal plus a `language` column on
`qr_assignments`.

### Template files

The specs reference `Mint_Rewards_Standee_Template-English.pdf`. The actual files are
`Mint Rewards Standee Template-English.pdf` (spaces) and `Mint Rewards Standee
Template.pdf` (Urdu, no language suffix). Normalized to underscored, explicitly
language-suffixed names on the way into `templates/`.

### Open

- **Production QR domain.** It is baked into every printed code — codes generated against
  a placeholder domain stop working when the domain changes. Must be confirmed before any
  standee goes to print.
- App Store and Play Store URLs — env placeholders until supplied.
- Deployment target — Vercel assumed (`after()` is supported there).
- Docker availability for local Supabase integration tests.
