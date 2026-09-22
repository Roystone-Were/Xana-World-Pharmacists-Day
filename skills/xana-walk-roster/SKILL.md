---
name: xana-walk-roster
description: Get the people registered for the Xana World Pharmacists Day Walk (26 Sept 2026). Use when asked who signed up, how many walkers, T-shirt counts, or for the attendance roster.
---

# Xana Walk Roster

## Quick answer (no setup)

Totals and T-shirt breakdown are public aggregates. Fetch:

```powershell
curl "https://xana-world-pharmacists-day.vercel.app/api/count"
```

Response fields: `total` (number), `sizes` (`XS/S/M/L/XL/XXL`, plus a legacy
`Not sure yet` row from before the option was removed from the form),
`backend` (`shared` = zero-setup counter, `upstash` = roster-capable),
`days` (per-day map, upstash only), `roster` (key-gated, see below).

Live snapshot 2026-09-21 (clean rotation): **84 registered**
(XS 3 · S 5 · M 22 · L 26 · XL 22 · XXL 6 · Not sure yet 2 legacy; sizes indicative — 2 pre-cleanup test ticks unrecoverable).

## Names / phones / emails (the actual walker list)

The counter stores **aggregates only** on the `shared` backend — names are
never there by design. The source of truth is the organizer inbox
(`ORGANIZER_EMAIL`, currently `joywincate@xanalife.com`): one email per
registration, subject `New walker registered: <name> (<ref>)` or
`New registration: Xana World Pharmacists Day Walk` (FormSubmit fallback).
Search the inbox by subject; each mail carries a unique reference
(`XANA-YYYY-XXXXX`) to cross-check against the counter. Reference the
counter as indicative only: it ticks when the confirmation screen shows.

## Key-gated roster (only when Upstash is deployed)

If `/api/count` answers `"backend": "upstash"`, a per-person roster exists
for sign-ups recorded after the Upstash deploy (earlier sign-ups stay
inbox-only). Read it with the organizer key:

```powershell
curl "https://xana-world-pharmacists-day.vercel.app/api/count?key=YOUR_COUNT_KEY"
# roster: [{ ref, name, phone, email, size, at }]
```

Without `?key=<COUNT_KEY>` (12+ chars, Vercel env `COUNT_KEY`) the API
returns `roster: null`. The `/count` page shows the same roster when opened
as `/count?key=YOUR_COUNT_KEY`. Never log, paste, or commit the key or
roster contents; names/phones/emails stay out of the repo.

## Rules

- Totals: quote `total` + `sizes` directly from the API, never estimate.
- Walker list: inbox first; roster endpoint only as a complement.
- On `shared` backend, say plainly: no per-person store exists, use inbox.
- Roster coverage starts at the Upstash deploy; always note earlier
  sign-ups are inbox-only.
