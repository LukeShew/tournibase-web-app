import { describe, expect, it } from "vitest";
import { buildManifest, CONNECTED_ACCOUNT, CUTOFF, EVENT_IDS, generateSql, MARKER, ORGANIZATION_ID, OWNER_ID, preview, PROJECT_ID, snapshotQuery } from "./seed-staging-volume.mjs";

function fixture() {
  const definitions = [
    { id: 1, start: "2026-07-11", end: "2026-07-12", baseline: [19, 16, 20], tickets: [1, 2, 3] },
    { id: 3, start: "2026-07-18", end: "2026-07-19", baseline: [20, 20, 30], tickets: [7, 8, 9] },
    { id: 4, start: "2026-08-29", end: "2026-08-30", baseline: [3, 2, 2], tickets: [10, 11, 12] },
    { id: 6, start: "2026-10-17", end: "2026-10-18", baseline: [0, 0, 0], tickets: [16, 17, 18] },
  ];
  const next = day => new Date(Date.parse(`${day}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10);
  return {
    version: 1, project: PROJECT_ID, asOf: CUTOFF,
    events: definitions.map(def => ({
      id: def.id, name: `Tournament ${def.id}`, slug: `tournament-${def.id}`, startDate: def.start, endDate: def.end, timeZone: "America/New_York",
      organizationId: ORGANIZATION_ID, ownerId: OWNER_ID, environment: "test", connectedAccount: CONNECTED_ACCOUNT,
      baseline: { orderCount: def.baseline[0], capturedOrderCount: def.baseline[1], passCount: def.baseline[2], markerCount: 0 },
      hashes: Object.fromEntries(["event", "tickets", "orders", "items", "passes", "scanners", "checkIns", "manualSales", "emails"].map(key => [key, "1234567890abcdef1234567890abcdef"])),
      tickets: def.tickets.map((id, index) => ({
        id, name: ["Saturday Pass", "Sunday Pass", "Weekend Pass"][index], priceCents: index === 2 ? 1500 : 1000,
        validFrom: `${index === 1 ? def.end : def.start}T04:00:00Z`, validUntil: `${next(index === 0 ? def.start : def.end)}T03:59:59.999Z`,
        status: "active", quantityLimit: def.id === 3 ? 1000 : null, occupied: 0,
      })),
    })),
  };
}

describe("approved staging volume seed generator", () => {
  it("replays deterministically without mutating its reviewed snapshot", () => {
    const snapshot = fixture();
    const before = JSON.stringify(snapshot);
    expect(buildManifest(snapshot)).toEqual(buildManifest(snapshot));
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it("varies volume, preserves history, and adds realistic family-sized orders", () => {
    const manifest = buildManifest(fixture());
    expect(new Set(manifest.events.map(event => event.targetPasses)).size).toBe(4);
    expect(new Set(manifest.events.map(event => event.targetCapturedOrders)).size).toBe(4);
    for (const event of manifest.events) {
      expect(event.targetPasses).toBeGreaterThanOrEqual(830);
      expect(event.targetPasses).toBeLessThanOrEqual(1040);
      expect(event.targetCapturedOrders).toBeGreaterThanOrEqual(350);
      expect(event.targetCapturedOrders).toBeLessThanOrEqual(450);
      expect(event.baseline.capturedOrderCount + event.orders.length).toBe(event.targetCapturedOrders);
      const quantities = event.orders.map(order => order.items.reduce((sum, item) => sum + item.quantity, 0));
      expect(event.baseline.passCount + quantities.reduce((sum, count) => sum + count, 0)).toBe(event.targetPasses);
      expect(new Set(quantities)).toEqual(new Set([1, 2, 3, 4]));
      expect(event.orders.some(order => order.items.length > 1)).toBe(true);
      expect(new Set(event.orders.map(order => order.buyer)).size).toBe(event.orders.length);
      expect(new Set(event.orders.map(order => order.team)).size).toBeGreaterThan(5);
      for (const ticket of event.tickets) {
        const units = event.orders.flatMap(order => order.items).filter(item => item.ticketId === ticket.id).reduce((sum, item) => sum + item.quantity, 0);
        expect(units).toBeGreaterThan(0);
        if (ticket.quantityLimit !== null) expect(units + ticket.occupied).toBeLessThanOrEqual(ticket.quantityLimit);
      }
    }
  });

  it("keeps unique markers, money, prices and pass windows internally consistent", () => {
    const allEmails = new Set();
    for (const event of buildManifest(fixture()).events) {
      for (const order of event.orders) {
        expect(order.email).toMatch(new RegExp(`^${MARKER}e${event.id}-\\d{3}@example\\.com$`));
        expect(allEmails.has(order.email)).toBe(false);
        allEmails.add(order.email);
        expect(order.amountCents).toBe(order.items.reduce((sum, item) => sum + item.unitCents * item.quantity, 0));
        expect(new Set(order.items.map(item => item.ticketId)).size).toBe(order.items.length);
        for (const item of order.items) {
          const ticket = event.tickets.find(candidate => candidate.id === item.ticketId);
          expect(item.name).toBe(ticket.name);
          expect(item.unitCents).toBe(ticket.priceCents);
          expect(item.validFrom).toBe(ticket.validFrom);
          expect(item.validUntil).toBe(ticket.validUntil);
          expect(item.quantity).toBeGreaterThanOrEqual(1);
          expect(item.quantity).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it("spreads orders over event week without future or post-validity timestamps", () => {
    const manifest = buildManifest(fixture());
    for (const event of manifest.events) {
      const dateKeys = new Set();
      const weekday = new Date(`${event.startDate}T12:00:00Z`).getUTCDay();
      const weekStart = Date.parse(`${event.startDate}T04:00:00Z`) - ((weekday + 6) % 7) * 86400_000;
      for (const order of event.orders) {
        const at = Date.parse(order.at);
        dateKeys.add(new Intl.DateTimeFormat("en-CA", { timeZone: event.timeZone }).format(new Date(at)));
        expect(at).toBeGreaterThanOrEqual(weekStart);
        expect(at).toBeLessThan(Date.parse(CUTOFF));
        for (const item of order.items) expect(at).toBeLessThan(Date.parse(item.validUntil));
      }
      expect(dateKeys.size).toBeGreaterThanOrEqual(event.id === 6 ? 6 : 7);
    }
  });

  it.each([
    ["project", snapshot => { snapshot.project = "wrong"; }],
    ["environment", snapshot => { snapshot.events[0].environment = "live"; }],
    ["owner", snapshot => { snapshot.events[0].ownerId = "other-owner"; }],
    ["organization", snapshot => { snapshot.events[0].organizationId = 2; }],
    ["account", snapshot => { snapshot.events[0].connectedAccount = "acct_other"; }],
    ["event allowlist", snapshot => { snapshot.events[0].id = 99; }],
    ["cutoff", snapshot => { snapshot.asOf = "2030-01-01T00:00:00Z"; }],
    ["preexisting seed", snapshot => { snapshot.events[0].baseline.markerCount = 1; }],
    ["hashes", snapshot => { snapshot.events[0].hashes.passes = "missing"; }],
    ["free ticket", snapshot => { snapshot.events[0].tickets[0].priceCents = 0; }],
    ["inactive ticket", snapshot => { snapshot.events[0].tickets[0].status = "inactive"; }],
    ["overfull event", snapshot => { snapshot.events[0].baseline.passCount = 5000; }],
    ["capacity", snapshot => { for (const ticket of snapshot.events[0].tickets) ticket.quantityLimit = 1; }],
  ])("fails closed on wrong %s", (_label, mutate) => {
    const snapshot = fixture();
    mutate(snapshot);
    expect(() => buildManifest(snapshot)).toThrow();
  });

  it("generates only inserts into orders/items/passes with snapshot and rerun guards", () => {
    const sql = generateSql(buildManifest(fixture()));
    const insertTables = [...sql.matchAll(/insert into public\.(\w+)/gi)].map(match => match[1]);
    expect(insertTables).toEqual(["orders", "order_items", "passes"]);
    expect(/\b(update public\.|delete from|truncate|alter table|create table|disable trigger|set role)\b/i.test(sql)).toBe(false);
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("if v_markers=0 then");
    expect(sql).toContain("Incomplete/colliding seed markers");
    expect(sql).toContain("v_hashes <> v_event->'hashes'");
    expect(sql).toContain("o.stripe_checkout_id is null");
    expect(sql).toContain("o.stripe_payment_intent_id is null");
    expect(sql).toContain("o.stripe_charge_id is null");
    expect(sql).toContain("p.status='active'");
    expect(sql).toContain("into strict v_order");
    expect(sql).toContain("into strict v_item_id");
    expect(sql).toContain(`where t.id in (${EVENT_IDS.join(",")})`);
  });

  it("emits a read-only snapshot query and a credential-free concise preview", () => {
    const query = snapshotQuery();
    expect(query).not.toMatch(/\b(insert into|update|delete from|create table|alter table)\b/i);
    expect(query).toContain("order by x.order_id");
    expect(query).toContain("'markerCount'");
    const result = preview(buildManifest(fixture()));
    expect(result.events).toHaveLength(4);
    expect(result.events.map(event => event.id)).toEqual(EVENT_IDS);
    expect(JSON.stringify(result)).not.toContain(OWNER_ID);
    expect(JSON.stringify(result)).not.toContain(CONNECTED_ACCOUNT);
  });
});
