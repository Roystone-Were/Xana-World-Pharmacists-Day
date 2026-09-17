// GET /api/count: live registration numbers for the /count page.
// Answers: { configured, total, days: {...}, sizes: {"M": 12, ...} }
// Aggregates only. No personal data is stored or returned.
//
// Backend: built-in shared counters (works with zero setup).
// With Upstash env vars set, answers also include the per-day breakdown.

const SHARED_GET_URL = "https://abacus.jasoncameron.dev/get/Lad2aDNnjM6vcgr0/I0hS5C0I0JRbElDM";

// Mirrors api/register.js. One counter per T-shirt size: [namespace, key].
const SIZE_COUNTERS = {
  "XS": ["-QHC3wr4w34QVTvc", "6e2VJG4vUZOlTQFZ"],
  "S": ["8qItEmpUOIwYMG-G", "lCt-EPZXcwuQRaMv"],
  "M": ["BNFoU0A62cDpqe7G", "ekoQPA_iAfKgPS0V"],
  "L": ["leJ9rm_yoRoJJJ4W", "4MkIKgpYHnZatumI"],
  "XL": ["7sAV7EO6fovmvMD-", "IMKhaAX19KxZly2c"],
  "XXL": ["XvIxzcWoBgL2oUbx", "FE3e3k7xU3M1zLwv"],
  "Not sure yet": ["3BNcQ-0L_BIzpFy4", "MNJIGphgrUOCwjvU"],
};

async function getSharedSizes() {
  const entries = await Promise.all(
    Object.keys(SIZE_COUNTERS).map((size) =>
      fetch(
        "https://abacus.jasoncameron.dev/get/" + SIZE_COUNTERS[size][0] + "/" + SIZE_COUNTERS[size][1]
      )
        .then((r) => (r.ok ? r.json() : { value: 0 }))
        .then((o) => [size, Number(o && o.value != null ? o.value : 0)])
        .catch(() => [size, 0])
    )
  );
  const sizes = {};
  entries.forEach(([s, n]) => {
    sizes[s] = n;
  });
  return sizes;
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const smsReady = !!(process.env.AT_API_KEY && process.env.AT_USERNAME);

  // Preferred backend: Upstash (total + per-day).
  if (url && token) {
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
      return res.status(200).json({ configured: true, total, days, sizes: await getSharedSizes(), backend: "upstash", sms: smsReady });
    } catch (e) {
      return res.status(500).json({ configured: true, total: null, days: {}, sizes: {}, error: "counter-error", sms: smsReady });
    }
  }

  // Zero-setup backend: shared counter (total only).
  try {
    const r = await fetch(SHARED_GET_URL);
    if (!r.ok) throw new Error(`shared-${r.status}`);
    const out = await r.json();
    return res.status(200).json({ configured: true, total: Number(out.value), days: {}, sizes: await getSharedSizes(), backend: "shared", sms: smsReady });
  } catch (e) {
    return res.status(200).json({ configured: false, total: null, days: {}, sizes: {}, sms: smsReady });
  }
};
