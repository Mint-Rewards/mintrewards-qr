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
| `AMBASSADOR_CARDS_BUCKET` | **Public** bucket (unlike the two above) — see [Mint Ambassador Program](#mint-ambassador-program). |

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
psql "$DATABASE_URL" -f supabase/migrations/0001_init.sql            # tables, indexes, triggers
psql "$DATABASE_URL" -f supabase/migrations/0002_rls.sql             # row level security
psql "$DATABASE_URL" -f supabase/migrations/0003_views.sql           # analytics views
psql "$DATABASE_URL" -f supabase/migrations/0004_ambassadors.sql     # Mint Ambassador tables
psql "$DATABASE_URL" -f supabase/migrations/0005_ambassadors_rls.sql # Mint Ambassador RLS
psql "$DATABASE_URL" -f supabase/migrations/0006_ambassador_views.sql # Mint Ambassador views
psql "$DATABASE_URL" -f supabase/migrations/0007_universities.sql    # university list + seed
```

Supabase direct connections are IPv6-only; from an IPv4 network use the pooler host
(`aws-0-<region>.pooler.supabase.com:5432`, user `postgres.<project-ref>`). Or paste each
file into the dashboard SQL editor.

### 2. Storage buckets

Create `generated-standees` and `qr-images` as **private**. Standee PDFs are served
through short-lived signed URLs, never public links.

Create `ambassador-cards` as **public**. Ambassador cards are meant to be reshared on
LinkedIn/Instagram, and those platforms' crawlers fetch the image unauthenticated —
potentially long after any signed URL would have expired. See
[Mint Ambassador Program](#mint-ambassador-program).

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

## Mint Ambassador Program

A second, separate attribution funnel for the student ambassador program (launched for
World Cleanup Day). It reuses the same architectural patterns as the field-team QR system
but is a distinct flow end to end:

| Field team QR system | Mint Ambassador program |
|---|---|
| `qr_assignments` + `qr_codes` (2 codes/assignment, iOS+Android) | `ambassador_campaigns` (1 code/campaign) |
| QR → redirects to an app store | QR → opens a public sign-up **form** |
| `qr_scan_events` | `ambassador_scan_events` (form views) + `mint_ambassadors` (submissions) |
| Attribution question: which team member/location scanned best? | Attribution question: which campaign converted views into sign-ups? |

### The registration flow

`GET /a/[code]` — public, unauthenticated, same trust boundary as `/r/[platform]/[code]`.
Validates the tracking code, looks up the campaign, logs a view (`ambassador_scan_events`,
via `after()`, same "never delay the page" rule as the redirect route), and renders a form
asking for name, university and batch year.

**University is a pick-list**, not free text, seeded with 73 major Pakistani campuses
(`universities`, 44 public / 29 private) plus an **Other** option that reveals a text
field. Free text made the programme's central question unanswerable — "LUMS", "Lums" and
"Lahore University of Management Sciences" are one campus and three rows — so listed
picks also store a `university_id` foreign key, and only genuine long-tail entries are
text. The list is seeded, not exhaustive; extend it in the `universities` table.

**Names are validated** (`src/lib/ambassador/validation.ts`): letters, spaces, hyphens,
apostrophes and full stops only, 2–60 characters, with cheap keyboard-mashing checks
(tripled letters, home-row runs, long unvowelled runs). Latin-only is deliberate — the
card renders through Liberation Sans, which has no Urdu glyphs, so an Urdu-script name
would silently come out as empty boxes on the card rather than being caught at the form.
`tests/ambassador-validation.test.ts` guards the false-rejection side, which matters more:
a student whose real name is refused just leaves, while junk that gets through is visible
to an admin on the roster.

On submit (`submitAmbassadorRegistration`, a server action using the service-role client —
`mint_ambassadors` has no client insert policy, same asymmetry as `qr_scan_events`):

1. Batch year decides status: **before 2026 → alumnus, 2026 or later → student**
   (`ALUMNUS_CUTOFF_YEAR` in `src/lib/ambassador/config.ts` — a business rule, not something
   derived from the data, so it is one named constant rather than a magic number).
2. The registration is saved.
3. A JPG card is generated (`src/lib/ambassador/card.ts`) and uploaded to the **public**
   `ambassador-cards` bucket.
4. The student sees an inline welcome screen with the card, a download button, and
   LinkedIn/Instagram share buttons.

### The card template

`templates/ambassador-card-background.jpg` is **Ambassador Design 2**, flattened from
`templates/Ambassador Design 2.pdf`. The PDF is 756 × 1200 pt and is rasterised at 144 dpi
— exactly 2× its point space — giving a 1512 × 2400 background where every measurement is
a whole pixel.

The three values are written onto the design's own ruled lines, which were **measured, not
estimated**: the raster was scanned for rows of grey pixels, putting the rules at `y=1300`
(x 80–788), `y=1402` and `y=1488` (both x 80–560). Each baseline sits 16 px above its rule
so the text rests on the line. The name is set in capitals in the card's teal, matching the
design.

### Updating the design

Drop the new artwork in at `templates/Ambassador Design 2.pdf` — same path, same name —
and run:

```bash
npm run build:card-template     # needs poppler (pdftoppm)
```

That re-flattens the background at 144 dpi and then **re-measures the ruled lines**,
reporting whether the layout still matches what `card-config.ts` is calibrated to:

```
Ruled lines found in the new artwork:
  y=1300  x=80..788
  y=1402  x=80..560
  y=1488  x=80..560

Layout unchanged — existing calibration still applies.
```

If the artwork only changes wording or colour, that's the whole job — commit the
regenerated JPG and you're done. If the script reports moved rules or a changed page
size, re-measure `NAME_BOX`/`UNIVERSITY_BOX`/`BATCH_BOX` in
`src/lib/ambassador/card-config.ts` and the `ROWS` constants in `tests/ambassador.test.ts`
(which describe the template, not the config — see below) against the numbers it printed.
Generation **throws** on a page-size change rather than stamping text in the wrong place.

Then check it at `/dev/ambassador-card-preview` (auth required; `?name=`, `?university=`
and `?batchYear=` override the dummy data) and run `npm test`.

> **Known issue in the current artwork:** the heading reads **"MINT ABASSADOR"** — missing
> the M. It is baked into the supplied PDF, so it can only be fixed in the design file and
> re-flattened with the command above.

Values are **measured, then fitted**: each line is rendered and trimmed to get its true
width, shrunk proportionally if it exceeds its slot, and truncated only once it hits
`MIN_FONT_SIZE`. A per-character width estimate is not good enough here — long names are
the norm, and "Muhammad Abdul Rahman Khan" renders ~6% wider than an em-ratio predicts,
which is enough to push it over the panel border.

> ### ⚠️ Card text depends on fonts being installed on the host
> sharp renders SVG text through the system's fontconfig. A deployment host with no fonts
> produces a card with **blank value slots** and no error. `tests/ambassador.test.ts`
> catches this — it diffs two renders that differ only in one field, so missing text means
> identical images and a failed test. Verify on the real host before the launch.

### Why sharing works the way it does

Neither LinkedIn nor Instagram lets a third-party site open their share dialog with a
pre-typed caption — see the comments in `src/lib/ambassador/share.ts` for the specifics.
In short:

- **LinkedIn**'s share intent takes only a URL; it reads the caption from that page's Open
  Graph tags. `/a/card/[id]` exists specifically to be that page — it's the durable, public,
  OG-tagged URL handed to LinkedIn's share dialog, not the card image itself.
- **Instagram** has no web share intent at all. The button copies the caption to the
  clipboard, downloads the image, and opens Instagram — the student pastes and attaches
  it themselves.

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

The ambassador card has an equivalent test: it renders two cards differing in exactly one
field, diffs the pixels, and asserts the changed region **rests on that field's ruled line**
and stays within the rule's horizontal span. Those bounds are measured from the template
image, not imported from `card-config.ts` — asserting against the same constants that drove
the render would pass no matter how wrong the calibration was.

Both vertical bounds matter. Checking only that text sits *above* its rule lets it float
anywhere up the card and still pass; the lower bound is what pins it to the design. The
suite is mutation-checked against a value shifted off its rule, dropped below it, widened
past it, and two rows swapped. It also catches a font-less deployment host, since two
different names would then render identically.

Coverage: tracking-code entropy/uniqueness/charset, user-agent parsing, redirect
destinations, invalid-code fallback, `no-store`, scan recording and attribution,
dashboard aggregation, RLS enforcement (anonymous reads blocked, scan forgery blocked),
standee placement, standee route auth, storage upload and bucket privacy, ambassador batch
classification, ambassador card placement/overflow/dimension-guard/XML-escaping, ambassador
sharing (caption fallback, LinkedIn share URL), and an ambassador end-to-end run (public
form view logging, registration, real card upload to a public bucket, dashboard
aggregation, RLS).

### Manual verification

1. Create a team member.
2. Create an assignment for them — confirm iOS and Android codes appear with distinct URLs.
3. Click **Generate Standee**, open the PDF, confirm both QRs sit inside their placeholders.
4. Scan each with a real phone; confirm iOS → App Store and Android → Play Store.
5. Confirm both scans appear on the assignment detail page and in the dashboard totals.
6. Visit an invalid code (`/r/ios/ZZZZZZZZZZZZ`) and confirm a silent fallback redirect.

Step 4 needs a `QR_PUBLIC_BASE_URL` the phone can reach — a tunnel or deployed
environment, not `localhost`.

### Manual verification — Mint Ambassador program

1. Create an ambassador campaign and set it **active** — confirm a QR code appears.
2. Scan it (or open the tracking URL) and submit the form with a batch year before 2026 —
   confirm the campaign detail page lists them as an alumnus.
3. Submit again with 2026 or later — confirm they're listed as a student.
4. Confirm the welcome screen shows a card image, and Download/LinkedIn/Instagram buttons
   all work (LinkedIn opens its share dialog on `/a/card/[id]`; Instagram copies the caption
   and downloads the image).
5. Confirm the dashboard's Mint Ambassador Program section and the campaign's view/
   registration/conversion counts update.
6. Set the campaign to **draft** or **paused** and confirm its tracking URL now shows the
   "not active" message instead of the form.

---

## Future: signup attribution

v1 tracks **scans** completely. Linking scans to actual signups requires changes outside
this tool. The schema is already prepared: `attributed_signups` exists (unused), and every
scan carries qr_code, assignment, team member, platform and location.

See [docs/signup-attribution.md](docs/signup-attribution.md) for what the mobile app and
backend must add.
