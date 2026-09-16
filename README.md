# Xana World Pharmacists Day Walk: Registration Site

Single-page registration site for the **Saturday 26 September 2026** walk
(held in celebration of World Pharmacists Day, Friday 25 September 2026;
TRM Mall → Xana Plus, Ruiru). Brand-matched to the xana-skincare inspiration
site: deep green `#005c3a`, orange accent `#f58a07`, cream `#faf8f6`,
Manrope display + Plus Jakarta Sans body.

## 1. Set your email (required, 1 minute)

Every registration is emailed to the organizer. Open `config.js` and replace:

```js
organizerEmail: "organizer@xanapharmacy.com",
```

with your real inbox, e.g. `organizerEmail: "you@xanapharmacy.co.ke",`.

It uses **FormSubmit (free, no backend)**. The first submission triggers a
one-time activation email from FormSubmit to that inbox. Click **Activate**,
and every later sign-up flows straight in with the subject
"New registration: Xana World Pharmacists Day Walk". The walker is CC'd on
the same email so they receive the details and reference (`_cc`), and
organizer replies go straight to the walker (`_replyto`). Note: FormSubmit's
`_autoresponse` cannot fire over AJAX, so it is intentionally not used.

## 2. Preview locally

Just open `index.html` in a browser, or serve it:

```powershell
npx serve "C:\Users\user\_Projects\XanaPharmacy\World_Pharmacist_Day"
```

## 3. Deploy to Vercel (your shareable link)

Option A (drag and drop): https://vercel.com/new → import this folder.
Option B (CLI):

```powershell
npm i -g vercel
vercel --prod
```

The resulting `https://…vercel.app` link is what you send to participants.

## 4. Key facts on the page

- Assemble TRM Mall 6:00 AM · step-off 6:30 AM · finish Xana Plus, Ruiru
- ~20 km · ~4 hrs · 7 checkpoints (TRM Drive, Lumumba Drive, Githurai 44,
  Plant House, The Nord Mall)
- Registration closes **Wednesday 23 Sept · 9:00 PM EAT** (live countdown;
  the form auto-closes after the deadline)
- Collects: full name, phone, email + fitness/marshal consent (simple set)
- Poster + route map PDFs in `assets/` (from the invitation email)

## 5. Tracking numbers

- Inbox: one email per registration (search the form subject to count).
- FormSubmit dashboard + the mailto fallback keep nobody lost if offline.

## 6. Live counter at /count (works out of the box)

The site has a separate organizers-only page at `https://…vercel.app/count`
showing the live total. It ticks on every confirmation screen via
`POST /api/register` and needs no setup: it uses a built-in shared counter
backend (aggregates only, no personal data).

## 7. Attendance roster backup (one-time setup)

If organizer emails ever fail, `/count` doubles as a backup roster. It needs
a free Upstash Redis store plus an organizer passcode:

1. Create a free database at https://upstash.com (Redis, region near
   Nairobi). Copy its **REST URL** and **REST token**.
2. In Vercel: project → Settings → Environment Variables, add
   `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `COUNT_KEY`
   (any long secret, min 12 chars), then redeploy.
3. From then on, every registration stores name + phone keyed by reference.
4. Open `https://…vercel.app/count?key=YOUR_KEY` to see totals, sign-ups per
   day, and the full attendance roster. Without the key, only totals show.

Note: the inbox stays the source of truth (one email per registration, each
with a unique reference to cross-check against the counter).
