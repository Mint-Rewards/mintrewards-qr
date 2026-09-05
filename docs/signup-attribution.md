# Future: connecting signups to QR scans

v1 tracks **scans** end to end. Connecting a scan to an actual MintRewards **signup**
cannot be done inside this standalone tool — it requires changes in the mobile app and
the main MintRewards backend. This document records exactly what those are.

## What already exists

The schema is prepared. `attributed_signups` is created and empty:

| Column | Purpose |
|---|---|
| `user_id` | The MintRewards user who signed up |
| `qr_code_id`, `assignment_id`, `team_member_id` | Full attribution chain |
| `platform` | ios / android |
| `signup_at` | When the signup happened |
| `attribution_source` | How the link was established (see below) |

Every scan event already carries the same chain, so once a signup can be tied to a
tracking code, the join is trivial.

## The missing link

The gap is the **app store handoff**. When a user scans a standee they leave for the App
Store or Play Store, and the tracking code does not survive that jump. The app installs
with no knowledge of which standee sent the user.

Three options, in descending order of reliability.

### Option 1 — Deferred deep linking (recommended)

Use a deferred deep link provider (Branch, AppsFlyer, Adjust, or Firebase Dynamic Links'
successor). The redirect route sends the user to a provider link carrying the tracking
code; the provider preserves it through install and hands it to the app on first launch.

**Requires:**
- Provider SDK integrated into the MintRewards app.
- `destination_url` on `qr_codes` changed to the provider link (the schema already stores
  a per-code destination, so this is a data change, not a migration).
- App reads the deferred link payload on first launch and sends `tracking_code` with the
  signup request.
- Backend endpoint accepts `tracking_code` on signup and posts to this system.

**Accuracy:** high. This is the only option that reliably survives install.

### Option 2 — Play Install Referrer (Android only)

Android's Play Install Referrer API passes a `referrer` string through install. Append
`&referrer=<tracking_code>` to the Play Store URL and read it in the app.

**Requires:** Play Install Referrer library in the app; backend accepts the value.

**Accuracy:** good on Android. **iOS has no equivalent**, so this covers only part of the
field, and iOS/Android performance stops being comparable.

### Option 3 — Manual code entry

Print the assignment's reference code on the standee and ask users to enter it during
signup ("Enter the code from the poster").

**Requires:** a field in the app signup flow; no SDK.

**Accuracy:** low — most users skip it — but it is the only option needing no attribution
infrastructure, and it works identically on both platforms.

## Ingesting attributed signups

Whichever option is chosen, the MintRewards backend needs to notify this system. Add an
authenticated endpoint here (service-role, not public):

```
POST /api/attribution/signup
{ "tracking_code": "...", "user_id": "...", "signup_at": "...", "attribution_source": "deferred_deep_link" }
```

It resolves `tracking_code` → `qr_codes`, then writes `attributed_signups` with the full
chain denormalised the same way `qr_scan_events` does.

Once populated, the existing analytics views extend naturally: scans → signups becomes a
conversion rate per team member, per location and per platform — which answers the
question this system exists to ask.

## Notes

- **Do not** reuse the public tracking code as an auth token on that endpoint. It is
  printed on a poster in public; anyone can read it. Authenticate the backend separately.
- Deduplicate on `user_id`: a user may reinstall, and one signup should attribute once.
- Keep `attribution_source` populated. When several mechanisms run at once, knowing which
  produced a given row is what makes the numbers trustworthy.
