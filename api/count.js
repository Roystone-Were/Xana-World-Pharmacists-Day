// GET /api/count: live registration numbers for the /count page.
// Answers: { configured, total, days: {...}, sizes: {"M": 12, ...} }
// With a valid organizer key (?key=COUNT_KEY) it also answers the
// attendance roster: roster: [{ ref, name, phone, email, size, at }].
// Personal data is never returned without the key.
//
// Backend: built-in shared counters (works with zero setup).
// With Upstash env vars set, answers also include the per-day breakdown
// and the key-gated roster.

const SHARED_GET_URL = "https://abacus.jasoncameron.dev/get/xana-walk-2026/Feq1lPfkt_GNnCfy";

// Mirrors api/register.js. One counter per T-shirt size: [namespace, key].
const SIZE_COUNTERS = {
  "XS": ["xana-walk-2026", "xOEKDK3rrhaguBgT"],
  "S": ["xana-walk-2026", "9ithg68LeMPS_Ubi"],
  "M": ["xana-walk-2026", "M_sy7wqoMg6h1xSt"],
  "L": ["xana-walk-2026", "14gDeVhI8YFqYThR"],
  "XL": ["xana-walk-2026", "rJTpjy41vGIR71xv"],
  "XXL": ["xana-walk-2026", "DAz6O1I3rvDd2Ea2"],
  "Not sure yet": ["xana-walk-2026", "9eTCSBC97kg7vvBe"],
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

  // Preferred backend: Upstash (total + per-day + key-gated roster).
  if (url && token) {
    const countKey = process.env.COUNT_KEY || "";
    const givenKey = req.query && typeof req.query.key === "string" ? req.query.key : "";
    const rosterAllowed = countKey.length >= 12 && givenKey !== "" && givenKey === countKey;
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    try {
      const commands = [["GET", "xana-walk:total"], ["HGETALL", "xana-walk:days"]];
      if (rosterAllowed) commands.push(["HGETALL", "xana-walk:roster"]);
      const r = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers,
        body: JSON.stringify(commands),
      });
      if (!r.ok) throw new Error(`upstash-${r.status}`);
      const out = await r.json();
      const total = out && out[0] && out[0].result != null ? Number(out[0].result) : 0;
      const flat = out && out[1] && Array.isArray(out[1].result) ? out[1].result : [];
      const days = {};
      for (let i = 0; i < flat.length; i += 2) {
        days[flat[i]] = Number(flat[i + 1]);
      }
      const answer = { configured: true, total, days, sizes: await getSharedSizes(), backend: "upstash", sms: smsReady, roster: null };
      const rflat = rosterAllowed && out[2] && Array.isArray(out[2].result) ? out[2].result : null;
      if (rflat) {
        const roster = [];
        for (let i = 0; i < rflat.length; i += 2) {
          try {
            const entry = JSON.parse(rflat[i + 1]);
            roster.push({
              ref: rflat[i],
              name: String(entry.n || "").slice(0, 60),
              phone: String(entry.p || "").slice(0, 30),
              email: String(entry.e || "").slice(0, 120),
              size: String(entry.s || "").slice(0, 15),
              at: String(entry.d || ""),
            });
          } catch (e) {
            roster.push({ ref: rflat[i], name: "", phone: "", email: "", size: "", at: "" });
          }
        }
        roster.sort((a, b) => (a.ref < b.ref ? -1 : 1));
        answer.roster = roster;
      }
      return res.status(200).json(answer);
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
