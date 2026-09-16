// POST /api/register — increments the walk registration counter.
// Body: { reference: "XANA-2026-ABCDE" }
// Stores aggregates only (total + per-day counts + reference IDs for
// dedupe). Names, phones and emails go to the organizer inbox, never here.
//
// Requires Vercel env vars:
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
// If they are missing, registration still succeeds by email and this
// endpoint answers { ok: false, counted: false } so the site keeps working.

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

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return res.status(200).json({ ok: false, counted: false, reason: "counter-not-configured" });
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

  const day = nairobiDay();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
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
    const total = out && out[0] ? Number(out[0].result) : null;
    return res.status(200).json({ ok: true, counted: true, total });
  } catch (e) {
    return res.status(200).json({ ok: false, counted: false, reason: "counter-error" });
  }
};
