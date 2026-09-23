// POST /api/register: counter + email + walker SMS confirmation.
// Body: { reference: "XANA-2026-ABCDE", name: "...", phone: "...", email: "...", tshirt: "L" }
// Counter stores aggregates only. The phone number is used transiently to
// send the confirmation SMS and is never stored.
//
// Email via Mailgun (full control of subject and body), needs Vercel env vars:
//   MG_API_KEY, MG_DOMAIN, ORGANIZER_EMAIL (who receives the signup mail)
//   MG_API_BASE  (optional, for EU accounts: https://api.eu.mailgun.net)
//   MG_FROM      (optional sender label, default "Xana Walk <walk@DOMAIN>")
// Without MG_* vars no Mailgun mail is sent; the site falls back to
// FormSubmit for the organizer mail (see script.js), and email + counter
// keep working regardless.
//
// SMS via Africa's Talking, needs Vercel env vars:
//   AT_API_KEY, AT_USERNAME            (required for SMS, see README 8)
//   AT_SENDER                          (optional registered sender ID)
//   AT_NOTIFY_NUMBER                   (optional, e.g. +254142631157: also
//                                       SMS-alerts the organizers per signup)
// Without AT_* vars SMS is skipped silently; email + counter keep working.
// Counter backend: built-in shared counter, or Upstash when
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are present.
//
// Registration is closed: the window shut on Wednesday 23 Sept 2026 at noon
// EAT - the deadline below, which is how both the API and the page close. The
// switch remains a manual override (REGISTRATION_OPEN="false" closes it
// regardless; REGISTRATION_DEADLINE moves the cut-off). Both gates run before
// any counter tick, roster row or mail send.
const REGISTRATION_CLOSED = process.env.REGISTRATION_OPEN === "false";

// Mirrors config.js registrationDeadlineISO so page and API close at the same
// instant. Set REGISTRATION_DEADLINE to another ISO 8601 instant to move it
// without editing this file.
const DEADLINE_MS = Date.parse(process.env.REGISTRATION_DEADLINE || "2026-09-23T12:00:00+03:00");

function isRegistrationOpen() {
  if (REGISTRATION_CLOSED) return false;
  return !(Number.isFinite(DEADLINE_MS) && Date.now() > DEADLINE_MS);
}

// Every registration notice is copied to a second mailbox as well, so the
// walker record (name, phone, email, T-shirt, reference) survives independently
// of the primary inbox and the 24h Mailgun body retention, and can be extracted
// at any time with tools/extract-registrations.mjs. The /count roster needs
// Upstash env vars; the mailboxes never expire. Set MG_CC="off" to stop the
// duplicate, or MG_CC to another address to send it elsewhere.
const ORGANIZER_CC = process.env.MG_CC === "off" ? "" : process.env.MG_CC || "roystone@xanalife.com";

const SHARED_HIT_URL = "https://abacus.jasoncameron.dev/hit/xana-walk-2026/Feq1lPfkt_GNnCfy";

// One shared counter per T-shirt size: [namespace, key]. Public by design
// (counters only, no personal data). Sizes always tracked here so the
// breakdown works with zero setup, whatever the main counter backend is.
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const SIZE_COUNTERS = {
  "XS": ["xana-walk-2026", "xOEKDK3rrhaguBgT"],
  "S": ["xana-walk-2026", "9ithg68LeMPS_Ubi"],
  "M": ["xana-walk-2026", "M_sy7wqoMg6h1xSt"],
  "L": ["xana-walk-2026", "14gDeVhI8YFqYThR"],
  "XL": ["xana-walk-2026", "rJTpjy41vGIR71xv"],
  "XXL": ["xana-walk-2026", "DAz6O1I3rvDd2Ea2"],
  // Legacy row: option removed from the form, key kept so /count history still renders.
  "Not sure yet": ["xana-walk-2026", "9eTCSBC97kg7vvBe"],
};
const AT_URL = "https://api.africastalking.com/version1/messaging";
const CARE_NUMBER = "+254142631157";

function nairobiDay() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// "0712 345 678" -> "+254712345678". Null when not a valid Kenyan mobile.
function toE164KE(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (/^[17]\d{8}$/.test(d)) d = "254" + d; // 9-digit mobile without prefix
  else if (d.startsWith("0")) d = "254" + d.slice(1);
  if (!d.startsWith("+")) d = "+" + d;
  return /^\+254\d{9}$/.test(d) ? d : null;
}

async function sendSms(to, message) {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;
  if (!apiKey || !username) return false;
  try {
    const params = new URLSearchParams({ username, to, message });
    if (process.env.AT_SENDER) params.append("from", process.env.AT_SENDER);
    const r = await fetch(AT_URL, {
      method: "POST",
      headers: {
        apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });
    if (!r.ok) return false;
    const out = await r.json();
    const recips = out && out.SMSMessageData && out.SMSMessageData.Recipients;
    return (
      Array.isArray(recips) &&
      recips.some((x) => x.status === "Success" || x.statusCode === 101)
    );
  } catch (e) {
    return false;
  }
}

// Idempotent record: the roster row is written only for a new reference,
// so re-submissions append nothing again.
async function countViaUpstash(url, token, reference, day, detail) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const commands = [
    ["INCR", "xana-walk:total"],
    ["HINCRBY", "xana-walk:days", day, "1"],
    ["SADD", "xana-walk:refs", reference],
  ];
  if (detail) {
    // HSETNX writes the per-person row only for a new reference. Best-effort:
    // never fails the registration.
    commands.push([
      "HSETNX",
      "xana-walk:roster",
      reference,
      JSON.stringify({
        n: String(detail.name || "").slice(0, 60),
        p: String(detail.phone || "").slice(0, 30),
        e: String(detail.email || "").slice(0, 120),
        s: String(detail.tshirt || "").slice(0, 15),
        d: String(detail.submittedAt || ""),
        m: String(detail.mail || ""),
      }),
    ]);
  }
  const r = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers,
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`upstash-${r.status}`);
  const out = await r.json();
  return out && out[0] ? Number(out[0].result) : null;
}

// Duplicate detection. Same reference is always a re-submit. Otherwise the
// walker matches when the phone matches (last 9 digits, so 0712/712/+254712
// all collide) or when email AND normalized name both match. Shared family
// emails with different names are NOT duplicates (Peter vs WinAlison case).
// Seen references live in xana-walk:refs (Upstash SET); without Upstash the
// counter backend is aggregates-only, so this check is skipped.
function normPhoneKey(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length > 9 ? d.slice(-9) : d;
}
function normKey(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function isSameWalker(a, b) {
  const pa = normPhoneKey(a.phone);
  const pb = normPhoneKey(b.phone);
  if (pa.length >= 9 && pa === pb) return true;
  const ea = normKey(a.email);
  const eb = normKey(b.email);
  const na = normKey(a.name);
  const nb = normKey(b.name);
  return !!(ea && eb && ea === eb && na && nb && na === nb);
}
async function findDuplicate(url, token, detail) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const r = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      ["SISMEMBER", "xana-walk:refs", detail.reference],
      ["HGETALL", "xana-walk:roster"],
    ]),
  });
  if (!r.ok) throw new Error(`upstash-${r.status}`);
  const out = await r.json();
  if (out && out[0] && Number(out[0].result) === 1) {
    return { reference: detail.reference, reason: "same-reference" };
  }
  const flat = out && out[1] && Array.isArray(out[1].result) ? out[1].result : [];
  for (let i = 0; i < flat.length; i += 2) {
    try {
      const row = JSON.parse(flat[i + 1]);
      if (isSameWalker({ name: detail.name, phone: detail.phone, email: detail.email },
        { name: row.n, phone: row.p, email: row.e })) {
        return { reference: flat[i], reason: "same-walker" };
      }
    } catch (e) { /* skip corrupt rows */ }
  }
  return null;
}

async function countViaShared() {
  const r = await fetch(SHARED_HIT_URL);
  if (!r.ok) throw new Error(`shared-${r.status}`);
  const out = await r.json();
  return Number(out.value);
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const LOGO_URL =
  process.env.LOGO_URL || "https://xana-world-pharmacists-day.vercel.app/assets/logo.png";

function mailShell(title, inner) {
  return (
    '<!doctype html><html><head><meta charset="utf-8"/><meta name="color-scheme" content="light dark"/><meta name="supported-color-schemes" content="light dark"/>' +
    '<style>@media (prefers-color-scheme: dark){.outer{background-color:#1c1c1e !important;}.card{background-color:#101012 !important;border-color:#3a3a3a !important;}.h1{color:#ffffff !important;}.sub{color:#b5b5b5 !important;}.rowbox{background-color:#1a1a1d !important;border-color:#2c2c30 !important;}.lbl{color:#8a8a8a !important;}.val{color:#ffffff !important;}.rule{border-color:#2c2c30 !important;}.foot,.caption{color:#8a8a8a !important;}}@media screen and (max-width:600px){.pad{padding:28px 20px !important;}}</style>' +
    '</head><body style="margin:0;padding:24px 12px;background-color:#eef2ef;font-family:Arial,Helvetica,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" class="outer" style="background-color:#eef2ef;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="card" style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid #dfe5e1;border-radius:16px;"><tr><td class="pad" style="padding:36px 32px;text-align:center;">' +
    '<div style="display:inline-block;background-color:#ffffff;border-radius:12px;padding:10px 22px;">' +
    '<img src="' + LOGO_URL + '" width="200" alt="Xana Life, Every Day Better" style="display:block;width:200px;max-width:100%;height:auto;border:0;"/>' +
    '</div>' +
    '<div class="h1" style="font-size:22px;font-weight:700;color:#0f2a20;margin:22px 0 8px;">' + title + '</div>' +
    inner +
    '</td></tr></table>' +
    '<div class="caption" style="font-size:12px;color:#7a8781;margin-top:16px;">Xana World Pharmacists Day Walk</div>' +
    '</td></tr></table></body></html>'
  );
}

function mailRows(pairs) {
  const out = [];
  pairs.forEach(function (p, i) {
    if (i > 0) out.push('<tr><td height="10" style="font-size:0;line-height:0;">&nbsp;</td></tr>');
    out.push(
      '<tr><td class="rowbox" style="background-color:#f2f6f3;border:1px solid #e2e8e4;border-radius:10px;padding:12px 16px;text-align:left;">' +
      '<div class="lbl" style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7a71;">' + p[0] + '</div>' +
      '<div class="val" style="font-size:15px;font-weight:700;color:#14231c;margin-top:4px;">' + p[1] + '</div>' +
      '</td></tr>'
    );
  });
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin-top:14px;">' + out.join("") + '</table>';
}

function mailButton(text, url) {
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td align="center" style="background-color:#005c3a;border-radius:10px;">' +
    '<a href="' + url + '" style="display:block;padding:14px 20px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">' + text + '</a>' +
    '</td></tr></table>'
  );
}

function mailDivider(note) {
  return (
    '<div class="rule foot" style="border-top:1px solid #e2e8e4;margin-top:22px;padding-top:14px;font-size:12px;color:#7a8781;line-height:1.6;">' + note + '</div>'
  );
}

function walkerMailHtml(d) {
  const wa =
    "https://wa.me/254142631157?text=" +
    encodeURIComponent("Hello Xana Life, I have a question about the World Pharmacists Day Walk. My reference is " + d.reference + ".");
  return mailShell(
    "Karibu, " + esc(d.firstName) + "!",
    '<div class="sub" style="font-size:15px;color:#5b6a61;line-height:1.6;">You are registered for the Xana World Pharmacists Day Walk.</div>' +
      mailRows([
        ["Walk day", "Saturday 26 September 2026"],
        ["Assemble", "TRM Mall from 6:00 AM"],
        ["Step-off", "6:30 AM sharp"],
        ["Finish", "Xana Plus, Ruiru (about 20 km)"],
        ["Reference", esc(d.reference)],
      ]) +
      mailButton("Chat with us on WhatsApp", wa) +
      mailDivider("Bring comfortable walking shoes, water and sun protection. Enquiries: +254 142 631 157.<br/>In celebration of World Pharmacists Day (Fri 25 Sept).")
  );
}

function organizerMailHtml(d) {
  return mailShell(
    "New walker registered",
    '<div class="sub" style="font-size:15px;color:#5b6a61;line-height:1.6;">' + esc(d.name || "A walker") + ' just signed up for the walk.</div>' +
      mailRows([
        ["Reference", esc(d.reference)],
        ["Full name", esc(d.name)],
        ["Phone", esc(d.phone)],
        ["Email", esc(d.email || "Not provided")],
        ["T-shirt size", esc(d.tshirt || "Not provided")],
        ["Consent", "Fit to walk, follows marshals"],
        ["Submitted", esc(d.submittedAt)],
      ]) +
      mailDivider("Automated registration notice. Reply to this email to reach the walker directly (when an address was provided).")
  );
}

async function sendMailgun({ to, subject, text, html, replyTo }) {
  const apiKey = process.env.MG_API_KEY;
  const domain = process.env.MG_DOMAIN;
  if (!apiKey || !domain || !to) return false;
  try {
    const base = (process.env.MG_API_BASE || "https://api.mailgun.net").replace(/\/$/, "");
    const from = process.env.MG_FROM || "Xana Walk <walk@" + domain + ">";
    const params = new URLSearchParams({ from, to, subject, text });
    if (html) params.append("html", html);
    if (replyTo) params.append("h:Reply-To", replyTo);
    const auth = Buffer.from("api:" + apiKey).toString("base64");
    const r = await fetch(base + "/v3/" + domain + "/messages", {
      method: "POST",
      headers: {
        Authorization: "Basic " + auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

function organizerMailText(d) {
  return [
    "A new walker registered for the Xana World Pharmacists Day Walk.",
    "",
    "Event: " + d.event,
    "Reference: " + d.reference,
    "Full name: " + d.name,
    "Phone number: " + d.phone,
    "Email address: " + (d.email || "Not provided"),
    "T-shirt size: " + (d.tshirt || "Not provided"),
    "T-shirt size: " + (d.tshirt || "Not provided"),
    "Fitness and safety consent: Yes, fit to walk and will follow marshals",
    "Submitted at: " + d.submittedAt,
    "",
    "This is an automated registration notice. Reply to this email to reach the walker directly (when an email address was provided).",
  ].join("\n");
}

function walkerMailText(d) {
  return [
    "Karibu " + d.firstName + "! You are registered for the Xana World Pharmacists Day Walk.",
    "",
    "Walk day: Saturday 26 September 2026 (in celebration of World Pharmacists Day, Fri 25 Sept).",
    "Assemble at TRM Mall from 6:00 AM. Walk starts 6:30 AM sharp.",
    "Finish: Xana Plus, Ruiru. About 20 km, around 4 hours on foot.",
    "",
    "Bring comfortable walking shoes, water and sun protection.",
    "",
    "Your reference: " + d.reference + " (also shown on your confirmation screen).",
    "",
    "Enquiries: " + CARE_NUMBER + ". See you there. Xana Life.",
  ].join("\n");
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  // Closed by the kill switch or by the deadline: reject before any validation,
  // counter tick, roster write or send.
  if (!isRegistrationOpen()) {
    return res.status(410).json({ ok: false, error: "closed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ ok: false, error: "bad-json" });
    }
  }
  const reference = body && typeof body.reference === "string" ? body.reference.trim() : "";
  if (!/^XANA-\d{4}-[A-Z0-9]{5}$/.test(reference)) {
    return res.status(400).json({ ok: false, error: "bad-reference" });
  }
  const walkerName = body && typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const walkerPhone = body && typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "";
  const walkerEmail = body && typeof body.email === "string" ? body.email.trim().slice(0, 120) : "";
  const walkerTshirt = body && typeof body.tshirt === "string" ? body.tshirt.trim().slice(0, 15) : "";
  if (!SIZES.includes(walkerTshirt)) {
    return res.status(400).json({ ok: false, error: "bad-tshirt" });
  }
  const emailOk = isEmail(walkerEmail);
  const organizerEmail = process.env.ORGANIZER_EMAIL || "";

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    let total;
    let backend;
    if (url && token) {
      const dup = await findDuplicate(url, token, {
        reference, name: walkerName, phone: walkerPhone, email: walkerEmail,
      }).catch(() => null); // never block registration on a lookup failure
      if (dup) {
        return res.status(200).json({ ok: true, counted: false, duplicate: true, ref: dup.reference, reason: dup.reason, backend: "upstash", sms: false, mail: { organizer: false, walker: false } });
      }
      total = await countViaUpstash(url, token, reference, nairobiDay(), {
        name: walkerName,
        phone: walkerPhone,
        email: walkerEmail,
        tshirt: walkerTshirt,
        submittedAt: new Date().toISOString(),
      });
      backend = "upstash";
    } else {
      total = await countViaShared();
      backend = "shared";
    }

    // T-shirt size breakdown (best-effort, never fails the registration).
    const sizeCounter = SIZE_COUNTERS[walkerTshirt];
    if (sizeCounter) {
      try {
        await fetch("https://abacus.jasoncameron.dev/hit/" + sizeCounter[0] + "/" + sizeCounter[1]);
      } catch (e) { /* sizes are indicative */ }
    }

    const mail = { organizer: false, walker: false };
    if (organizerEmail) {
      const detail = {
        event: "Xana World Pharmacists Day Walk",
        reference,
        name: walkerName,
        phone: walkerPhone,
        email: walkerEmail,
        tshirt: walkerTshirt,
        submittedAt: new Date().toISOString(),
      };
      // Primary inbox + the permanent second copy (ORGANIZER_CC above).
      const organizerRecipients = [organizerEmail, ORGANIZER_CC].filter(Boolean).join(", ");
      mail.organizer = await sendMailgun({
        to: organizerRecipients,
        subject: "New walker registered: " + (walkerName || "Walker") + " (" + reference + ")",
        text: organizerMailText(detail),
        html: organizerMailHtml(detail),
        replyTo: emailOk ? walkerEmail : undefined,
      });
      if (emailOk) {
        const firstName = (walkerName.split(" ")[0] || "Walker").slice(0, 20);
        mail.walker = await sendMailgun({
          to: walkerEmail,
          subject: "You are registered: Xana World Pharmacists Day Walk",
          text: walkerMailText({ firstName, reference }),
          html: walkerMailHtml({ firstName, reference }),
          replyTo: organizerEmail,
        });
      }
    }

    let sms = false;
    const to = toE164KE(walkerPhone);
    if (to) {
      const firstName = (walkerName.split(" ")[0] || "Walker").slice(0, 20);
      sms = await sendSms(
        to,
        "Karibu " +
          firstName +
          "! Xana Walk Sat 26 Sept confirmed. Assemble TRM Mall 6:00AM, step-off 6:30AM. Ref " +
          reference +
          ". Help: " +
          CARE_NUMBER
      );
      const notifyTo = process.env.AT_NOTIFY_NUMBER ? toE164KE(process.env.AT_NOTIFY_NUMBER) : null;
      if (notifyTo) {
        await sendSms(
          notifyTo,
          "New walker: " + walkerName.slice(0, 40) + " " + to + " Ref " + reference
        );
      }
    }

    return res.status(200).json({ ok: true, counted: true, total, backend, sms, mail });
  } catch (e) {
    return res.status(200).json({ ok: false, counted: false, reason: "counter-error", sms: false, mail: { organizer: false, walker: false } });
  }
};
