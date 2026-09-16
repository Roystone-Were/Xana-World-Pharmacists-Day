// POST /api/register — increments the walk registration counter.
// Body: { reference: "XANA-2026-ABCDE" }
// Stores aggregates only. Names, phones and emails go to the organizer
// inbox, never here.
//
// Backend: built-in shared counter (works with zero setup). If Upstash env
// vars (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) are present, the
// counter upgrades to Upstash, which additionally records per-day counts
// and reference IDs for dedupe.

const SHARED_HIT_URL = "https://abacus.jasoncameron.dev/hit/casfHolY2fMbgtbx/N-TyzgC5JKYidW3w";

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

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    if (url && token) {
      const total = await countViaUpstash(url, token, reference, nairobiDay());
      return res.status(200).json({ ok: true, counted: true, total, backend: "upstash" });
    }
    const total = await countViaShared();
    return res.status(200).json({ ok: true, counted: true, total, backend: "shared" });
  } catch (e) {
    return res.status(200).json({ ok: false, counted: false, reason: "counter-error" });
  }
};
