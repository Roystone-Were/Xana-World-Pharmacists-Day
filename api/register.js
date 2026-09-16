// POST /api/register: counter + walker SMS confirmation.
// Body: { reference: "XANA-2026-ABCDE", name: "...", phone: "..." }
// Counter stores aggregates only. The phone number is used transiently to
// send the confirmation SMS and is never stored.
//
// SMS via Africa's Talking, needs Vercel env vars:
//   AT_API_KEY, AT_USERNAME            (required for SMS, see README 8)
//   AT_SENDER                          (optional registered sender ID)
//   AT_NOTIFY_NUMBER                   (optional, e.g. +254142631157: also
//                                       SMS-alerts the organizers per signup)
// Without AT_* vars SMS is skipped silently; email + counter keep working.
// Counter backend: built-in shared counter, or Upstash when
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are present.

const SHARED_HIT_URL = "https://abacus.jasoncameron.dev/hit/AM3bvn_703hvTK_h/wPnChJ6NT-KwgAKb";
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

async function countViaUpstash(url, token, reference, day) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  // INCR total, HINCRBY per-day bucket, SADD reference (dedupe log).
  const r = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      ["INCR", "xana-walk:total"],
      ["HINCRBY", "xana-walk:days", day, "1"],
      ["SADD", "xana-walk:refs", reference],
    ]),
  });
  if (!r.ok) throw new Error(`upstash-${r.status}`);
  const out = await r.json();
  return out && out[0] ? Number(out[0].result) : null;
}

async function countViaShared() {
  const r = await fetch(SHARED_HIT_URL);
  if (!r.ok) throw new Error(`shared-${r.status}`);
  const out = await r.json();
  return Number(out.value);
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
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

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    let total;
    let backend;
    if (url && token) {
      total = await countViaUpstash(url, token, reference, nairobiDay());
      backend = "upstash";
    } else {
      total = await countViaShared();
      backend = "shared";
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

    return res.status(200).json({ ok: true, counted: true, total, backend, sms });
  } catch (e) {
    return res.status(200).json({ ok: false, counted: false, reason: "counter-error", sms: false });
  }
};
