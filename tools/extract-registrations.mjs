#!/usr/bin/env node
// Extracts every walk registration into one table, from every source that still
// holds it, and merges them by reference:
//
//   1. Mailgun events log for MG_DOMAIN - the organizer notices ("New walker
//      registered: ..."). Names + references survive ~5 days, the message
//      bodies (phone, email, T-shirt) only 24h, so run this regularly or rely
//      on the mailboxes below.
//   2. A mailbox dump written by tools/outlook-export.ps1 - permanent, and the
//      only source that survives Mailgun's retention window.
//
// Personal data is written outside the repo. Default output: ./.private/
// Usage:
//   MG_API_KEY=... node tools/extract-registrations.mjs --out DIR [--outlook dump.json]
//   node tools/extract-registrations.mjs --out DIR --outlook dump.json   (no Mailgun key: mailbox only)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const OUT_DIR = arg("--out", join(process.cwd(), ".private"));
const OUTLOOK = arg("--outlook", "");
const SINCE_HOURS = Number(arg("--since", "0"));
const AT_LOG = arg("--at-log", "");
const AT_USER = process.env.AT_USERNAME || "";
const AT_KEY = process.env.AT_API_KEY || "";
const DOMAIN = process.env.MG_DOMAIN || "xana.afyanalytics.net";
const KEY = process.env.MG_API_KEY || "";
const AUTH = "Basic " + Buffer.from("api:" + KEY).toString("base64");
const NOTICE = /walker registered|new registration/i;

// The mails arrive in three shapes: "Label: value" (Mailgun text),
// "Label\n value" (Mailgun html flattened) and "Label\t value" (FormSubmit).
function fields(body) {
  const b = String(body || "").replace(/\r/g, "");
  const get = (...labels) => {
    for (const label of labels) {
      for (const pattern of [`^${label}:[ \\t]*(.*)$`, `^${label}\\t[ \\t]*(.*)$`, `^${label}\\s*\\n[ \\t]*(.+)$`]) {
        const m = new RegExp(pattern, "mi").exec(b);
        if (m && m[1].trim()) return m[1].trim();
      }
    }
    return "";
  };
  const rawName = get("Full name", "fullName", "Name");
  return {
    ref: get("Reference"),
    name: /^(name|value)$/i.test(rawName.trim()) ? "" : rawName,
    phone: get("Phone number", "Phone").replace(/^o(?=\d)/, "0"),
    email: get("Email address", "Email"),
    size: get("T-shirt size", "Tshirt", "T-shirt"),
    submittedAt: get("Submitted at", "Submitted"),
  };
}
const clean = (v) => {
  const s = String(v == null ? "" : v).trim();
  return /^(not provided|—|-|n\/a)$/i.test(s) ? "" : s;
};
const subjectRef = (s) => (/\((XANA-[^)]+)\)/.exec(s || "") || [])[1] || "";
const subjectName = (s) =>
  String(s || "").replace(/^New (walker registered|registration( — Xana World Pharmacists Day Walk)?): /, "").replace(/ \(XANA-.*\)$/, "");

async function mailgunSource() {
  if (!KEY) {
    console.log("mailgun: skipped (no MG_API_KEY)");
    return [];
  }
  const rows = [];
  const seen = new Set();
  // The cutoff is applied per page, not via Mailgun's begin= parameter: begin=
  // returns the slice *older* than the timestamp (it behaves like an end
  // boundary), which fed expired notices with no stored body to the merge. The
  // log is newest-first, so paging simply stops at the first page that dips
  // below the cutoff.
  const cutoff = SINCE_HOURS > 0 ? Date.now() - SINCE_HOURS * 3600e3 : 0;
  let url = `https://api.mailgun.net/v3/${DOMAIN}/events?event=accepted&limit=300`;
  for (let page = 0; page < 60 && url; page++) {
    const r = await fetch(url, { headers: { Authorization: AUTH } });
    if (!r.ok) { console.log(`mailgun: events page failed (${r.status})`); break; }
    const j = await r.json();
    const items = j.items || [];
    for (const it of items) {
      const subject = it.message?.headers?.subject || "";
      if (!NOTICE.test(subject)) continue;
      const id = it.message?.headers?.["message-id"] || it.id;
      if (seen.has(id)) continue;
      seen.add(id);
      let detail = null;
      if (it.storage?.url) {
        const b = await fetch(it.storage.url, { headers: { Authorization: AUTH } });
        if (b.ok) {
          const body = await b.json();
          detail = fields(body["body-plain"] || body["stripped-text"] || body["body-html"] || "");
        }
      }
      const f = detail || {};
      rows.push({
        ref: f.ref || subjectRef(subject),
        name: f.name || subjectName(subject),
        phone: clean(f.phone), email: clean(f.email), size: clean(f.size),
        submittedAt: f.submittedAt || "", at: f.submittedAt || new Date(it.timestamp * 1000).toISOString(),
        source: detail ? "mailgun(body)" : "mailgun(subject)",
      });
    }
    const oldest = items.length ? items[items.length - 1].timestamp * 1000 : 0;
    if (cutoff && oldest && oldest < cutoff) break;
    url = j.paging?.next || null;
  }
  const withBody = rows.filter((r) => r.source === "mailgun(body)").length;
  console.log(`mailgun: ${rows.length} notices (${withBody} with body detail, ${rows.length - withBody} subject only)`);
  return rows;
}

function outlookSource() {
  if (!OUTLOOK) {
    console.log("outlook: skipped (no --outlook dump)");
    return [];
  }
  if (!existsSync(OUTLOOK)) throw new Error(`outlook dump not found: ${OUTLOOK}`);
  const raw = JSON.parse(readFileSync(OUTLOOK, "utf8").replace(/^\uFEFF/, ""));
  const rows = raw
    .filter((m) => NOTICE.test(m.subject || ""))
    .map((m) => {
      const f = fields(m.body);
      return {
        ref: f.ref || subjectRef(m.subject),
        name: f.name || subjectName(m.subject),
        phone: clean(f.phone), email: clean(f.email), size: clean(f.size),
        submittedAt: f.submittedAt || "", at: f.submittedAt || m.received,
        source: "mailbox",
      };
    })
    .filter((r) => r.ref);
  console.log(`outlook: ${raw.length} messages scanned, ${rows.length} registrations`);
  return rows;
}

// Walkers got a confirmation SMS carrying their reference, so Africa's Talking's
// message log maps reference -> phone number for every registration it reached.
// That is the reliable way to fill phones whose Mailgun body has expired
// (day-old notices) when the organizer mailbox is hard to reach.
//   --at-log FILE   a dump of the dashboard's message log (JSON), or
//   AT_USERNAME/AT_API_KEY   to fetch the log from the API directly.
async function smsSource() {
  let messages = [];
  if (AT_LOG) {
    const raw = JSON.parse(readFileSync(AT_LOG, "utf8").replace(/^\uFEFF/, ""));
    messages = raw.SMSMessageData?.Messages || raw.messages || (Array.isArray(raw) ? raw : []);
    console.log(`sms log file: ${messages.length} messages from ${AT_LOG}`);
  } else if (AT_USER && AT_KEY) {
    const r = await fetch(`https://api.africastalking.com/version1/messaging?username=${encodeURIComponent(AT_USER)}`, {
      headers: { apiKey: AT_KEY, Accept: "application/json" },
    });
    if (!r.ok) {
      console.log(`sms: fetch failed (${r.status})`);
      return [];
    }
    const j = await r.json();
    messages = j.SMSMessageData?.Messages || [];
    console.log(`sms: ${messages.length} messages from Africa's Talking`);
  } else {
    console.log("sms: skipped (no --at-log and no AT_USERNAME/AT_API_KEY)");
    return [];
  }

  const rows = [];
  for (const m of messages) {
    const text = String(m.text || m.message || "");
    const phone = normalisePhone(m.phoneNumber || m.number || m.to || "");
    const ref = (/XANA-\d{4}-[A-Z0-9]{5}/.exec(text) || [])[0] || "";
    if (!ref || !phone) continue;
    const name = (/^Karibu ([^!]+)!/.exec(text) || [])[1] || "";
    rows.push({ ref, name, phone, email: "", size: "", submittedAt: "", at: m.date || "", source: "sms" });
  }
  console.log(`sms: ${rows.length} messages carried a walk reference`);
  return rows;
}

// "0712345678" and "+254712345678" both arrive; keep what the walker typed where
// possible, otherwise present the international form.
function normalisePhone(p) {
  const s = String(p || "").trim();
  if (/^\+?\d{9,15}$/.test(s) === false) return "";
  if (s.startsWith("+254")) return "0" + s.slice(4);
  if (s.startsWith("254")) return "0" + s.slice(3);
  return s;
}

// Carries earlier runs forward: with --since the Mailgun pass only sees recent
// notices, so the previous snapshot is merged back in rather than dropped.
function previousSource(dir) {
  const file = join(dir, "registrations.json");
  if (!existsSync(file)) return [];
  try {
    const rows = JSON.parse(readFileSync(file, "utf8"));
    console.log(`previous: ${rows.length} rows carried forward from ${file}`);
    return rows.map((r) => ({ ...r, source: "previous" }));
  } catch (e) {
    console.log(`previous: unreadable (${e.message}) - starting fresh`);
    return [];
  }
}

// Merge by reference, keeping the richest record and never overwriting a known
// value with a blank one.
const rank = { "sms": 4, "mailbox": 3, "mailgun(body)": 3, "previous": 2, "mailgun(subject)": 1 };
const byRef = new Map();
for (const r of [
  ...(await smsSource()),
  ...(await mailgunSource()),
  ...outlookSource(),
  ...previousSource(OUT_DIR),
]) {
  const cur = byRef.get(r.ref);
  if (!cur) { byRef.set(r.ref, r); continue; }
  const winner = (rank[r.source] || 0) > (rank[cur.source] || 0) ? r : cur;
  const other = winner === r ? cur : r;
  byRef.set(r.ref, {
    ...winner,
    phone: winner.phone || other.phone,
    email: winner.email || other.email,
    size: winner.size || other.size,
    submittedAt: winner.submittedAt || other.submittedAt,
  });
}
const rows = [...byRef.values()].sort((a, b) => (a.at < b.at ? -1 : 1));

const cell = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
const csv = [["#", "submitted_at", "full_name", "phone", "email", "tshirt", "reference", "source"].join(",")]
  .concat(rows.map((r, i) => [i + 1, r.submittedAt || r.at, r.name, r.phone, r.email, r.size, r.ref, r.source].map(cell).join(",")))
  .join("\r\n");

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "registrations.json"), JSON.stringify(rows, null, 2));
writeFileSync(join(OUT_DIR, "registrations.csv"), "\uFEFF" + csv);
console.log(`\n${rows.length} unique references`);
console.log(`  with phone: ${rows.filter((r) => r.phone).length}`);
console.log(`  with email: ${rows.filter((r) => r.email).length}`);
console.log(`  with size:  ${rows.filter((r) => r.size).length}`);
console.log(`  sizes: ${JSON.stringify(rows.filter((r) => r.size).reduce((a, r) => (a[r.size] = (a[r.size] || 0) + 1, a), {}))}`);
console.log(`written: ${join(OUT_DIR, "registrations.csv")} and registrations.json`);
