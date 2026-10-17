import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const sql = readFileSync(new URL("./adjust-staging-attendance-20261017.sql", import.meta.url), "utf8");
const plan = [...sql.matchAll(/^    \((\d+),(\d+),(\d+),(\d+),'([^']+)'::timestamptz\)[,;]$/gm)].map((m) => ({
  pass: Number(m[1]), event: Number(m[2]), order: Number(m[3]), ticket: Number(m[4]), at: m[5],
}));
const counts = new Map([[1, 866], [3, 927], [4, 893], [5, 247], [6, 576]]);
const eventDates = new Map([[1, ["2026-07-11", "2026-07-12"]], [3, ["2026-07-18", "2026-07-19"]],
  [4, ["2026-08-29", "2026-08-30"]], [5, ["2026-09-19", "2026-09-20"]], [6, ["2026-10-17"]]]);

test("plan contains exactly 3,509 unique approved passes and approved event totals", () => {
  assert.equal(plan.length, 3509);
  assert.equal(new Set(plan.map((row) => row.pass)).size, plan.length);
  for (const [event, count] of counts) assert.equal(plan.filter((row) => row.event === event).length, count);
});

test("timestamps stay in event daytime windows and before the fixed cutoff", () => {
  for (const row of plan) {
    const date = new Date(row.at);
    assert.ok(eventDates.get(row.event).includes(row.at.slice(0, 10)));
    // Every approved date is EDT: 08:00-18:00 local = 12:00-22:00 UTC.
    assert.ok(date.getUTCHours() >= 12 && date.getUTCHours() < 22);
    assert.ok(date <= new Date("2026-10-17T21:41:00Z"));
  }
});

test("Sunday-only current-event passes and actual QA order are excluded", () => {
  assert.ok(plan.every((row) => row.order !== 1957));
  assert.ok(plan.filter((row) => row.event === 6).every((row) => row.ticket === 16 || row.ticket === 17));
});

test("selected family/day groups have adjacent arrival timestamps", () => {
  const groups = Map.groupBy(plan, (row) => row.order + ":" + row.at.slice(0, 10));
  for (const rows of groups.values()) {
    const times = rows.map((row) => Date.parse(row.at));
    assert.ok(Math.max(...times) - Math.min(...times) <= 5000);
  }
});

test("simulated manual entries remain a small minority", () => {
  for (const event of counts.keys()) {
    const rows = plan.filter((row) => row.event === event);
    const manual = rows.filter((row) => createHash("md5").update("attendance-source:" + row.pass).digest()[0] < 10).length;
    assert.ok(manual / rows.length >= 0.02 && manual / rows.length <= 0.06);
  }
});

test("script preserves protected history and prevents active scanner sessions", () => {
  assert.match(sql, /if actual<>expected then/);
  assert.match(sql, /No raw scanner token or URL is generated/);
  assert.match(sql, /staff_label,created_by,created_at,last_active_at,revoked_at/);
  assert.match(sql, /least\(cutoff,\(ev.end_date\+1\)::timestamp at time zone ev.time_zone\)/);
  assert.match(sql, /or exists\(select 1 from public.order_email_deliveries d where d.order_id=o.id\)/);
  assert.match(sql, /or exists\(select 1 from public.check_ins c where c.pass_id=p.id\)/);
  assert.match(sql, /o.stripe_checkout_id is not null or o.stripe_payment_intent_id is not null or o.stripe_charge_id is not null/);
  assert.match(sql, /a.admitted_at<greatest\(p.created_at,o.created_at\)\+interval '3 minutes'/);
  assert.match(sql, /set status='checked_in'/);
  assert.doesNotMatch(sql, /(?:update|delete from) public\.(?:orders|order_items|check_ins|scanner_sessions|manual_sales|ticket_types)\b/i);
});
