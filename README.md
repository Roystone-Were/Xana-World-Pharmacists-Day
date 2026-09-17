# Xana World Pharmacists Day Walk: Registration Site

Single-page registration site for the **Saturday 26 September 2026** walk
(held in celebration of World Pharmacists Day, Friday 25 September 2026;
TRM Mall → Xana Plus, Ruiru). Brand-matched to the xana-skincare inspiration
site: deep green `#005c3a`, orange accent `#f58a07`, cream `#faf8f6`,
Manrope display + Plus Jakarta Sans body.

## 1. Set your email (required, 1 minute)

Every registration is emailed to the organizer. There are two senders:

- **Mailgun (preferred):** full control of subject and body, reliable walker
  copies. One-time setup, see section 7.
- **FormSubmit fallback (works today, no setup):** used automatically until
  Mailgun is configured. Open `config.js` and set `organizerEmail`, e.g.
  `organizerEmail: "you@xanapharmacy.co.ke",`.

It uses **FormSubmit (free, no backend)**. The first submission triggers a
one-time activation email from FormSubmit to that inbox. Click **Activate**,
and every later sign-up flows straight in with the subject
"New registration: Xana World Pharmacists Day Walk". The walker is CC'd on
the same email so they receive the details and reference (`_cc`), and
organizer replies go straight to the walker (`_replyto`). Note: FormSubmit's
`_autoresponse` cannot fire over AJAX, so it is intentionally not used.

## 7. Email via Mailgun (one-time setup, preferred sender)

Mailgun sends fully-worded organizer and walker emails (no FormSubmit
wrapper text) and reports delivery per message in its dashboard Logs.

1. Sign up at https://www.mailgun.com. Add your domain: Sending → Domains →
   Add New Domain, enter `xanalife.com` (or a subdomain like
   `mail.xanalife.com`; the From address must live on the verified domain).
2. Add the DNS records Mailgun shows (two TXT records for SPF/DKIM, plus the
   tracking CNAME) where your DNS is hosted, then verify in Mailgun.
3. Copy the **Private API key** (Settings → API Keys) and note the API region:
   US accounts use `https://api.mailgun.net`, EU accounts use
   `https://api.eu.mailgun.net`.
4. In Vercel: project → Settings → Environment Variables, add
   `MG_API_KEY`, `MG_DOMAIN` (e.g. `xanalife.com`),
   `ORGANIZER_EMAIL` (e.g. `joywincate@xanalife.com`),
   `MG_FROM` (e.g. `Xana Walk <walk@xanalife.com>`), and if EU,
   `MG_API_BASE=https://api.eu.mailgun.net`. Then redeploy.
5. Test with your own address first. Until step 4 is done, the site keeps
   using the FormSubmit fallback automatically.

Sandbox note: Mailgun sandbox domains only deliver to Authorized Recipients
you add in the dashboard, so verify the real domain (step 2) before inviting
walkers. Volumes here are tiny; Mailgun includes trial sends.

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
- Collects: full name, phone, optional email, T-shirt size + fitness/marshal consent (simple set)
- Route map PDF in `assets/` (from the invitation email)

## 5. Tracking numbers

- Inbox: one email per registration (search the form subject to count).
- FormSubmit dashboard + the mailto fallback keep nobody lost if offline.

## 6. Live counter at /count (works out of the box)

The site has a separate organizers-only page at `https://…vercel.app/count`
showing the live total. It ticks on every confirmation screen via
`POST /api/register` and needs no setup: it uses a built-in shared counter
backend (aggregates only, no personal data). It also shows a **T-shirts
needed** breakdown per size plus a total, tracked the same way from each
registration's chosen size. Size tracking starts the moment this deploys;
earlier sign-ups count toward the total only.

Optional upgrade (per-day breakdown): create a free database at
https://upstash.com (Redis, region near Nairobi), then in Vercel go to
project → Settings → Environment Variables and add
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, then redeploy.
`/count` will then also list sign-ups per day.

Note: the inbox stays the source of truth (one email per registration, each
with a unique reference to cross-check against the counter).

## 8. Walker SMS via Africa's Talking (one-time setup)

Every registration triggers a confirmation SMS to the walker's phone
(confirmation screen says so only when the SMS is accepted). Without setup,
SMS is skipped silently and email + counter keep working.

1. Sign in at https://account.africastalking.com and create an app. Use the
   **Sandbox** app to test free (delivery is simulated in the dashboard);
   use a **Live** app for real walkers.
2. In the app: copy the **username** (Sandbox username is literally
   `sandbox`) and generate an **API key** under Settings.
3. In Vercel: project → Settings → Environment Variables, add
   `AT_API_KEY` and `AT_USERNAME`, then redeploy.
4. Optional vars: `AT_SENDER` (only if you own a registered sender ID;
   otherwise messages arrive from the shared short code), and
   `AT_NOTIFY_NUMBER` (e.g. `+254142631157`) to also SMS-alert the team on
   every signup.
5. For Live SMS, top up SMS credits in the Africa's Talking dashboard
   (M-PESA). Each confirmation is one short message.
