# MintRewards QR — Onboarding Attribution System

Internal admin tool for MintRewards' on-ground onboarding team. Admins create field team
members, assign QR standees to locations, generate printable standee PDFs, and track every
scan back to the team member, assignment, location and platform that produced it.

The product value is **attribution**, not QR generation.

---

## Quick start

```bash
nvm use                 # Node 22+ required (see below)
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

Open http://localhost:3000.

### Node 22+ is required

`@supabase/supabase-js` needs a native `WebSocket`, which Node ships from v22 onward. On
Node 20 the admin Supabase client **throws at runtime**, including inside the public
redirect route — scans stop being recorded. `.nvmrc` pins the version; `package.json`
declares `engines.node >= 22`.

---

## Configuration

All deployment-specific values are environment variables. See `.env.example`.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Safe in the browser; RLS protects the data behind them. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Bypasses RLS. Never prefix with `NEXT_PUBLIC_`. |
| `IOS_APP_STORE_URL` / `ANDROID_PLAY_STORE_URL` | Redirect destinations, resolved per QR code at creation time. |
| `QR_PUBLIC_BASE_URL` | **Baked into every printed QR.** See the warning below. |
| `QR_FALLBACK_URL` | Where invalid tracking codes land. Must be a real public page. |
| `GENERATED_STANDEES_BUCKET` / `QR_IMAGES_BUCKET` | Private Supabase Storage buckets. |

`src/lib/env.ts` validates everything at boot with zod, so a misconfigured deployment
fails loudly at startup rather than when someone scans a standee in the field.

> ### ⚠️ `QR_PUBLIC_BASE_URL` is permanent once printed
> A printed QR code encodes this base URL forever. Changing it after a print run
> **orphans every standee already in the field** — those codes cannot be updated.
> Confirm the final production domain before the first print run.

---

## Supabase setup

### 1. Migrations

Apply in order:

```bash
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql   # tables, indexes, triggers
psql "$DATABASE_URL" -f supabase/migrations/0002_rls.sql    # row level security
psql "$DATABASE_URL" -f supabase/migrations/0003_views.sql  # analytics views
```

Supabase direct connections are IPv6-only; from an IPv4 network use the pooler host
(`aws-0-<region>.pooler.supabase.com:5432`, user `postgres.<project-ref>`). Or paste each
file into the dashboard SQL editor.

### 2. Storage buckets

Create both as **private**: `generated-standees` and `qr-images`. Standee PDFs are served
through short-lived signed URLs, never public links.

### 3. Auth

Disable public signup in the dashboard. This is an invite-only internal tool: **every
authenticated user is an admin**. Create admins via Authentication → Users.

To add per-user roles later, add an `admin_users` allowlist table and change
`to authenticated` in `0002_rls.sql` to a membership check — the policy shape is unchanged.

---

## Architecture

### Three Supabase clients, deliberately separated

| File | Key | Used from |
|---|---|---|
| `lib/supabase/browser.ts` | anon | client components |
| `lib/supabase/server.ts` | anon + session cookie | admin pages and mutations (RLS applies) |
| `lib/supabase/admin.ts` | **service role** | redirect route + standee generation only |

`admin.ts` and `env.ts` are marked `server-only`, so importing them into a client
component is a build error. That is what keeps the service role key out of the browser.

### Row Level Security

Admin tables are readable/writable by authenticated users. `qr_scan_events` has
**no client insert policy at all** — scan writes happen exclusively server-side via the
service role, so a leaked anon key cannot forge or poison attribution data.

### Tracking codes

12 characters from a 32-character alphabet with look-alikes removed (no `0/O`, `1/I/L`),
drawn from `crypto.randomBytes` with rejection sampling to avoid modulo bias.
**60 bits of entropy**, URL-safe, never a database ID.

Uniqueness is guaranteed by the `UNIQUE` constraint, not a pre-flight check (which is racy
under concurrent creation); the app retries on a `23505` conflict.

Length is a deliberate trade-off: this keeps the encoded URL inside a **version-3 QR at EC
level M**, so modules stay coarse and scan reliably off a printed standee. Longer codes
push the version up and measurably hurt scanning.

### The redirect path

`GET /r/[platform]/[code]` is the only route the public touches. Three rules:

1. **Redirect first, log after.** The scan event is written inside Next's `after()`, so
   logging never delays the user.
2. **Never fail visibly.** Any error — unknown code, database down — redirects to
   `QR_FALLBACK_URL`. A scanner must never see an error; the standee is already printed.
3. **Never cache.** `Cache-Control: no-store`. A cached redirect is a silently lost scan
   event, and the under-count stays invisible until the analytics look wrong.

The destination comes from the QR code's **own platform**, never from user-agent sniffing —
an iOS QR always goes to the App Store. The detected OS is recorded separately, so
"scanned the Android code on an iPhone" shows up as a ⚠ in the UI: real signal about how
the standee reads in the field.

Link-preview fetchers (WhatsApp, iMessage, Slack) are **flagged, not dropped**
(`is_bot`). Dashboard views exclude them; the scans page can show them. Counts stay both
meaningful and auditable.

---

## Standee generation

The provided PDF template is used as-is — the design is never recreated. Only the two QR
placeholders are filled.

Placement lives in one place: `src/lib/standee/config.ts`. Those coordinates were
**measured, not estimated**: the page was rasterised at 72 dpi (1 px = 1 pt), the dashed
placeholder boxes located by connected-component analysis, then verified by stamping,
re-rasterising and machine-decoding the codes back out.

```
Template: 864 × 2160 pt (12" × 30"), single page
English:  iOS  x=132 y=212   Android x=522 y=212   (210 × 210, bottom-left origin)
```

### The Urdu template is mirrored

A second Urdu template exists and is **RTL-mirrored: iOS on the RIGHT, Android on the
LEFT** — the reverse of English — with boxes 17 pt higher. Assuming "left = iOS" would
send every iPhone user to the Play Store, and the mistake is invisible in the output
unless you read Urdu or decode the codes.

Urdu is **not wired up in v1**, but its verified coordinates are recorded in
`standee/config.ts` and covered by tests. Enabling it needs one object literal plus a
`language` column on `qr_assignments`.

### Recalibrating

If the template is ever re-exported, `generateStandeePdf` throws when the page size no
longer matches the calibrated dimensions rather than silently misplacing the codes.
Use `/dev/standee-preview` (auth required, `?language=urdu` supported) to check placement
visually without creating a real assignment.

To replace the template, drop the new PDF into `templates/`, update `fileName` in
`standee/config.ts`, re-measure the boxes and run `npm test`.

---

## Testing

```bash
npm test          # unit tests only (no credentials needed)
npm run typecheck
```

Integration tests run automatically when `.env.local` has real Supabase credentials, and
**skip** rather than fail without them.

For the standee-route test, also set:

```bash
E2E_ADMIN_EMAIL=you@example.com
E2E_ADMIN_PASSWORD=...       # or E2E_ADMIN_PASSWORD_FILE=/path/to/file
```

The most valuable test **generates a standee PDF, rasterises it, and decodes the QR codes
back out**, asserting the iOS payload sits in the iPhone box and Android in the Android
box. A coordinate typo or swapped platform fails CI instead of reaching a print shop.
It requires poppler (`pdftoppm`); without it those assertions skip with a warning.

Coverage: tracking-code entropy/uniqueness/charset, user-agent parsing, redirect
destinations, invalid-code fallback, `no-store`, scan recording and attribution,
dashboard aggregation, RLS enforcement (anonymous reads blocked, scan forgery blocked),
standee placement, standee route auth, storage upload and bucket privacy.

### Manual verification

1. Create a team member.
2. Create an assignment for them — confirm iOS and Android codes appear with distinct URLs.
3. Click **Generate Standee**, open the PDF, confirm both QRs sit inside their placeholders.
4. Scan each with a real phone; confirm iOS → App Store and Android → Play Store.
5. Confirm both scans appear on the assignment detail page and in the dashboard totals.
6. Visit an invalid code (`/r/ios/ZZZZZZZZZZZZ`) and confirm a silent fallback redirect.

Step 4 needs a `QR_PUBLIC_BASE_URL` the phone can reach — a tunnel or deployed
environment, not `localhost`.

---

## Future: signup attribution

v1 tracks **scans** completely. Linking scans to actual signups requires changes outside
this tool. The schema is already prepared: `attributed_signups` exists (unused), and every
scan carries qr_code, assignment, team member, platform and location.

See [docs/signup-attribution.md](docs/signup-attribution.md) for what the mobile app and
backend must add.
