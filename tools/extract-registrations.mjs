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
  let url = `https://api.mailgun.net/v3/${DOMAIN}/events?event=accepted&limit=300`;
  for (let page = 0; page < 60 && url; page++) {
    const r = await fetch(url, { headers: { Authorization: AUTH } });
    if (!r.ok) { console.log(`mailgun: events page failed (${r.status})`); break; }
    const j = await r.json();
    for (const it of j.items || []) {
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

// Merge by reference, keeping the richest record and never overwriting a known
// value with a blank one.
const rank = { "mailbox": 3, "mailgun(body)": 3, "mailgun(subject)": 1 };
const byRef = new Map();
for (const r of [...(await mailgunSource()), ...outlookSource()]) {
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
