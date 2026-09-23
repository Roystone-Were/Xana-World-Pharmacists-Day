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
- Registration is **closed** (see section 9): the form is replaced by the closed
  notice, the CTAs point at the walk-day details, and `POST /api/register`
  answers `410` to everything. The configured deadline
  (**Wednesday 23 Sept · 9:00 PM EAT**) remains the page's own cut-off, so the
  countdown and its staged urgency are intact if the site is ever reopened.
- Countdown urgency is staged: quiet ticking normally, **amber** with a soft
  glow and blinking colons inside the final 24h, **red** with a faster glow and
  a harder per-second pulse inside the final 6h, then "Registration closed".
  `prefers-reduced-motion` keeps the colours and drops every animation.
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

Optional upgrade (per-day breakdown + key-gated roster): create a free
database at https://upstash.com (Redis, region near Nairobi), then in Vercel
go to project → Settings → Environment Variables and add
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `COUNT_KEY` (a
secret of 12+ characters, e.g. a long random string; anyone holding it can
read the roster), then redeploy. `/count` will then also list sign-ups per
day. Open `/count?key=YOUR_KEY` (with your `COUNT_KEY`) to see the full
attendance roster: name, phone, email address, T-shirt size and reference per
walker. Without the key the page keeps showing aggregates only.

Note: the roster starts recording the moment this deploys; earlier sign-ups
appear in the inbox only. The inbox stays the source of truth (one email per
registration, each with a unique reference to cross-check against the
counter).

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

## 9. Closing and reopening registration

Registration is closed. Both switches must say open for a walker to get in, so
the site can never end up half-open (an open form that the API rejects, or a
live API behind a dead form):

| Switch | Controls | Closed (now) | Open |
| --- | --- | --- | --- |
| `registrationOpen` in `config.js` | the page: form, countdown, CTAs, copy | `false` | `true` |
| `REGISTRATION_OPEN` Vercel env var | `POST /api/register` | unset, or any value except `true` | `"true"` |

Closing is fail-safe on both sides: the API answers `410` unless the variable is
exactly `"true"`, and the page closes whenever `registrationOpen` is `false`.

- **To close:** `registrationOpen: false` in `config.js`, remove
  `REGISTRATION_OPEN` in Vercel (Settings → Environment Variables), redeploy.
- **To reopen:** `registrationOpen: true`, add `REGISTRATION_OPEN=true`,
  redeploy. The deadline (`registrationDeadlineISO`) still auto-closes the page.

While closed, walkers see "Online registration is closed" in the deadline bar, a
"Registration is closed" countdown and heading, a form-shaped notice carrying the
customer-care number, and no register CTA anywhere. `/count` keeps working and
shows the final totals; the organizer inbox stays the source of truth.

Residual case: a page already open in someone's browser at deploy time keeps
running the old script. Its submit is still rejected by the API (`410`), but the
old script answers that with a prefilled mail draft to the organizer inbox, so
treat any arrival after the close as unconfirmed and reply that registration has
closed.
