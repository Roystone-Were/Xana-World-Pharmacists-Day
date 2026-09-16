// GET /api/count — live registration numbers for the /count page.
// Answers: { configured, total, days: { "2026-09-16": 12, ... } }
// Aggregates only. No personal data is stored or returned.
//
// Requires Vercel env vars:
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return res.status(200).json({ configured: false, total: null, days: {} });
  }

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    const r = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers,
      body: JSON.stringify([["GET", "xana-walk:total"], ["HGETALL", "xana-walk:days"]]),
    });
    if (!r.ok) throw new Error(`upstash-${r.status}`);
    const out = await r.json();
    const total = out && out[0] && out[0].result != null ? Number(out[0].result) : 0;
    const flat = out && out[1] && Array.isArray(out[1].result) ? out[1].result : [];
    const days = {};
    for (let i = 0; i < flat.length; i += 2) {
      days[flat[i]] = Number(flat[i + 1]);
    }
    return res.status(200).json({ configured: true, total, days });
  } catch (e) {
    return res.status(500).json({ configured: true, total: null, days: {}, error: "counter-error" });
  }
};
