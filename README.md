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
- Registration is **open again** (see section 9), closing at the configured
  deadline **Wednesday 23 Sept · 9:00 PM EAT**: the page hides the form at that
  instant and `POST /api/register` starts answering `410` at the same moment.
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

## 9. Opening, closing and the deadline

Registration was closed on the morning of 23 Sept and **reopened the same day**.
Two switches control it, plus the deadline:

| Switch | Controls | Now | Effect |
| --- | --- | --- | --- |
| `registrationOpen` in `config.js` | the page: form, countdown, CTAs, copy | `true` | `false` replaces the form with the closed notice |
| `REGISTRATION_OPEN` Vercel env var | `POST /api/register` | unset = open | exactly `"false"` makes the API answer `410` |
| `registrationDeadlineISO` in `config.js` + `REGISTRATION_DEADLINE` in Vercel | both | `2026-09-23T21:00:00+03:00` | page and API both close at that instant |

- **To close now:** set `registrationOpen: false` in `config.js`, redeploy.
  Optionally add `REGISTRATION_OPEN=false` in Vercel to close the API too.
- **To reopen:** `registrationOpen: true`, and remove/blank `REGISTRATION_OPEN`.
- **Deadline:** the API refuses `410` with `{"error":"closed"}` once the deadline
  passes, so a reopened site cannot keep taking walkers past the cut-off. The
  page shows its closed state at the same moment. To extend, change
  `registrationDeadlineISO` **and** set `REGISTRATION_DEADLINE` (ISO 8601) in
  Vercel, then redeploy — they are separate copies of the same instant.

While closed, walkers see "Online registration is closed" in the deadline bar, a
"Registration is closed" countdown and heading, a form-shaped notice carrying the
customer-care number, and no register CTA anywhere. `/count` keeps working; the
organizer inbox stays the source of truth.

Residual case: a page already open in someone's browser at deploy time keeps
running the old script. Its submit is still checked by the API — a `410` is
never treated as success by the current script.

## 10. Keeping the walker records (extract later)

Each registration carries name, phone, email, T-shirt size and a unique
reference. Where that record survives:

| Store | Holds | Lifetime |
| --- | --- | --- |
| Organizer inbox (`ORGANIZER_EMAIL`) | full notice per registration | permanent |
| Second organizer inbox (`MG_CC`, default `roystone@xanalife.com`) | the same notice | permanent |
| Mailgun events log (`api.mailgun.net/v3/xana.afyanalytics.net/events`) | name + reference in the subject | ~5 days |
| Mailgun message bodies | phone, email, size, reference | **24 h** |
| `/count` roster (`xana-walk:roster`) | full per-walker row | only when Upstash is configured |

The site itself keeps **aggregates only** unless Upstash is configured (section
6) — that is what the roster store is for. So the mailboxes are the durable,
machine-readable records, and `api/register.js` sends every notice to two of
them (`MG_CC` defaults to the second; `MG_CC="off"` disables the copy).

### Extract everything into one table

```powershell
# 1. Mailbox dump (Windows + Outlook, read-only, scans every store in the profile)
.\tools\outlook-export.ps1 -OutFile "$env:TEMP\xana-outlook.json"

# 2. Merge Mailgun's log (24h of details, 5 days of names) with the mailbox dump
$env:MG_DOMAIN = "xana.afyanalytics.net"
$env:MG_API_KEY = "<Mailgun private API key>"
node tools\extract-registrations.mjs --out "$env:USERPROFILE\Personal\Xana-Walk" `
     --outlook "$env:TEMP\xana-outlook.json"
```

Output: `registrations.csv` (spreadsheet-ready, BOM'd for Excel) and
`registrations.json`, merged by reference, newest source winning and blanks
never overwriting known values. Run it at any time; it is read-only and
idempotent. Without `--outlook` it uses Mailgun alone; without `MG_API_KEY` it
uses the mailbox alone.

Personal data must stay out of this repo: `.private/` is gitignored, and the
extractor defaults to writing there. Re-running it after the walk fills in
anything Mailgun had already expired, as long as the mail is still in a mailbox
the profile can read.

### Snapshot on a schedule (what keeps the details alive)

Mailgun keeps a notice's body for 24 h, so a run every 30 minutes makes the
records permanent without depending on any mailbox:

```powershell
# once: a task that runs every 30 minutes until Sunday 27 Sept, then expires
$repo = "C:\Users\user\_Projects\XanaPharmacy\World_Pharmacist_Day"
$args = "-NoProfile -ExecutionPolicy Bypass -File `"$repo\tools\refresh-records.ps1`" " +
        "-OutDir `"$env:USERPROFILE\Personal\Xana-Walk`" -KeyFile `"$env:USERPROFILE\Personal\_Garage\Mailgun-Xana.txt`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 30)
$trigger.EndBoundary = (Get-Date "2026-09-27T00:00:00").ToString("s")
Register-ScheduledTask -TaskName "XanaWalk-Records" `
  -Action (New-ScheduledTaskAction -Execute "powershell.exe" -Argument $args) -Trigger $trigger `
  -Principal (New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive) `
  -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew) -Force

Get-ScheduledTaskInfo -TaskName "XanaWalk-Records"          # last run + result
Unregister-ScheduledTask -TaskName "XanaWalk-Records" -Confirm:$false   # stop it
```

Registered on the organizer's machine as `XanaWalk-Records`, so
`%USERPROFILE%\Personal\Xana-Walk\registrations.csv` stays current on its own.
Each run appends one line to `refresh.log` and rewrites the CSV/JSON, merging
with the previous snapshot so nothing that has aged out of the window is lost.
`--since 26` keeps each run to a page or two of Mailgun events instead of
re-reading the whole log.

To make the **site** log records itself, set `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN` and `COUNT_KEY` in Vercel (section 6), redeploy, and
open `/count?key=YOUR_KEY`: every registration then lands in `xana-walk:roster`
and the roster lists name, phone, email, size and reference. That path is
already implemented in `api/register.js` and `api/count.js`.
