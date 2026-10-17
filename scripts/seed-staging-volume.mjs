/**
 * Offline generator for the explicitly approved Oct 17 staging volume top-up.
 * It never connects to Supabase/Stripe, sends email, or writes output files.
 *
 * 1. --snapshot-query prints a READ-ONLY query for the pinned Supabase project.
 * 2. Save its JSON result as a reviewed snapshot inside this project.
 * 3. --snapshot <file> --preview prints totals; --sql prints the guarded SQL.
 * Execute SQL only through an authenticated connection to PROJECT_ID below.
 * All existing rows are fingerprinted; no updates/deletes/schema changes occur.
 * Executed and verified on Oct 17, 2026. Later payment/admission QA changed the
 * new event, so the historical snapshot should now fail its guards. Do not
 * refresh the snapshot or bypass guards merely to rerun this completed top-up.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const PROJECT_ID = "khwaafsdtgiymucppkmo";
export const OWNER_ID = "c64721a2-024e-4019-a9db-9072fd330a8a";
export const ORGANIZATION_ID = 1;
export const CONNECTED_ACCOUNT = "acct_1Tui4qBDCykX1MuY";
export const CUTOFF = "2026-10-17T19:58:00Z";
export const EVENT_IDS = [1, 3, 4, 6];
export const MARKER = "volume-20261017-";
const FIRST = ["Jordan", "Taylor", "Morgan", "Cameron", "Alex", "Casey", "Riley", "Jamie", "Avery", "Drew", "Reese", "Parker", "Quinn", "Sam", "Logan", "Blake", "Charlie", "Hayden", "Skyler", "Rowan", "Sydney", "Jesse", "Dakota", "Finley"];
const LAST = ["Brooks", "Carter", "Davis", "Evans", "Foster", "Gray", "Hayes", "James", "King", "Lewis", "Miller", "Nelson", "Owens", "Parker", "Reed", "Scott", "Turner", "Walker", "Wright", "Young", "Adams", "Bennett", "Cole", "Ellis"];
const TEAMS = ["Carolina Storm", "Queen City Elite", "Triangle United", "Piedmont Hoops", "Coastal Flight", "Blue Ridge Select", "Capital City Stars", "Triad Thunder", "Charlotte United", "Carolina Flight", "Metro Select", "Oak City Hoops"];
const q = value => `'${String(value).replaceAll("'", "''")}'`;
const markerCondition = alias => `${alias}.buyer_email like '${MARKER}%'`;

function fingerprintSql(eventId, includeMarkers = false) {
  const orderFilter = includeMarkers ? "true" : `not (${markerCondition("o")})`;
  const rowHash = (table, where, join = "", sortKey = "id") => `(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.${sortKey}),'[]'::jsonb)::text) from public.${table} x ${join} where ${where})`;
  return `jsonb_build_object(
    'event',${rowHash("tournaments", `x.id=${eventId}`)},
    'tickets',${rowHash("ticket_types", `x.tournament_id=${eventId}`)},
    'orders',${rowHash("orders", `x.tournament_id=${eventId} and ${includeMarkers ? "true" : `not (${markerCondition("x")})`}`)},
    'items',${rowHash("order_items", `x.tournament_id=${eventId} and ${orderFilter}`, "join public.orders o on o.id=x.order_id")},
    'passes',${rowHash("passes", `x.tournament_id=${eventId} and ${orderFilter}`, "join public.orders o on o.id=x.order_id")},
    'scanners',${rowHash("scanner_sessions", `x.tournament_id=${eventId}`)},
    'checkIns',${rowHash("check_ins", `x.tournament_id=${eventId}`)},
    'manualSales',${rowHash("manual_sales", `x.tournament_id=${eventId}`)},
    'emails',${rowHash("order_email_deliveries", `o.tournament_id=${eventId}`, "join public.orders o on o.id=x.order_id", "order_id")}
  )`;
}

export function snapshotQuery() {
  return `-- READ ONLY. Execute only in Supabase project ${PROJECT_ID}.
select jsonb_build_object('version',1,'project',${q(PROJECT_ID)},'asOf',${q(CUTOFF)},
  'events',coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'name',t.name,'slug',t.public_slug,'startDate',t.start_date,'endDate',t.end_date,'timeZone',t.time_zone,
    'organizationId',org.id,'ownerId',org.owner_user_id,'environment',org.operating_environment,
    'connectedAccount',sa.stripe_account_id,
    'baseline',jsonb_build_object(
      'orderCount',(select count(*) from public.orders o where o.tournament_id=t.id),
      'capturedOrderCount',(select count(*) from public.orders o where o.tournament_id=t.id and o.payment_status in ('paid','partial_refund','refunded')),
      'passCount',(select count(*) from public.passes p where p.tournament_id=t.id),
      'markerCount',(select count(*) from public.orders o where o.tournament_id=t.id and ${markerCondition("o")})
    ),
    'hashes',${fingerprintSql("t.id", true)},
    'tickets',(select jsonb_agg(jsonb_build_object('id',tt.id,'name',tt.name,'priceCents',(tt.price*100)::integer,
      'validFrom',tt.valid_from,'validUntil',tt.valid_until,'status',tt.status,'quantityLimit',tt.quantity_limit,
      'occupied',coalesce((select sum(oi.quantity) from public.order_items oi join public.orders o on o.id=oi.order_id
        where oi.ticket_type_id=tt.id and (o.payment_status in ('paid','partial_refund') or
          (o.payment_status='pending' and o.inventory_expires_at>now()))),0)+
        coalesce((select sum(ms.quantity) from public.manual_sales ms where ms.ticket_type_id=tt.id),0)
      ) order by tt.id) from public.ticket_types tt where tt.tournament_id=t.id)
  ) order by t.id),'[]'::jsonb)) as snapshot
from public.tournaments t join public.organizations org on org.id=t.organization_id
join public.organization_stripe_accounts sa on sa.organization_id=org.id and sa.stripe_environment='test'
where t.id in (${EVENT_IDS.join(",")});`;
}

function rng(seed) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function localInstant(date, hour, minute, timeZone) {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const observed = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    instant += target - observed;
  }
  return instant;
}

function datePlus(date, days) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function chooseWeighted(candidates, random, weight) {
  let remaining = random() * candidates.reduce((sum, item) => sum + weight(item), 0);
  return candidates.find(item => (remaining -= weight(item)) < 0) ?? candidates.at(-1);
}

function timestampFor(event, items, random, cutoff) {
  const weekday = new Date(`${event.startDate}T12:00:00Z`).getUTCDay();
  const monday = datePlus(event.startDate, -((weekday + 6) % 7));
  const lastAllowed = Math.min(cutoff - 60_000, ...items.map(item => Date.parse(item.validUntil) - 60_000));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = datePlus(monday, index);
    return { index, start: localInstant(date, 7, 0, event.timeZone), end: Math.min(localInstant(date, 21, 0, event.timeZone), lastAllowed) };
  }).filter(day => day.end >= day.start);
  if (!days.length) throw new Error(`Event ${event.id}: no safe order timestamps before cutoff.`);
  const day = chooseWeighted(days, random, entry => [4, 15, 22, 24, 19, 11, 5][entry.index]);
  const minute = Math.floor(random() * (day.end - day.start) / 60_000);
  return new Date(day.start + minute * 60_000).toISOString();
}

export function buildManifest(snapshot) {
  if (snapshot?.version !== 1 || snapshot.project !== PROJECT_ID || snapshot.asOf !== CUTOFF) throw new Error("Unexpected snapshot project/version/cutoff.");
  if (JSON.stringify(snapshot.events?.map(event => event.id).sort((a, b) => a - b)) !== JSON.stringify(EVENT_IDS)) throw new Error("Snapshot must contain exactly approved event IDs 1,3,4,6.");
  const cutoff = Date.parse(snapshot.asOf);
  const events = [...snapshot.events].sort((a, b) => a.id - b.id).map(event => {
    if (event.organizationId !== ORGANIZATION_ID || event.ownerId !== OWNER_ID || event.environment !== "test" || event.connectedAccount !== CONNECTED_ACCOUNT) throw new Error(`Event ${event.id}: staging routing mismatch.`);
    if (event.baseline.markerCount !== 0) throw new Error(`Event ${event.id}: capture a pre-seed snapshot; markers already exist.`);
    if (!event.hashes || Object.values(event.hashes).some(hash => !/^[a-f0-9]{32}$/.test(hash)) || Object.keys(event.hashes).length !== 9) throw new Error(`Event ${event.id}: invalid row fingerprints.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(event.endDate)) throw new Error(`Event ${event.id}: invalid dates.`);
    if (!event.tickets?.length || event.tickets.some(ticket => !Number.isSafeInteger(ticket.id) || !Number.isSafeInteger(ticket.priceCents) || ticket.priceCents <= 0 || ticket.status !== "active" || !Number.isFinite(Date.parse(ticket.validFrom)) || !Number.isFinite(Date.parse(ticket.validUntil)))) throw new Error(`Event ${event.id}: missing/invalid active paid tickets.`);
    const random = rng(`${MARKER}${event.id}`);
    const targetPasses = 830 + Math.floor(random() * 211);
    const targetCapturedOrders = 350 + Math.floor(random() * 101);
    const addPasses = targetPasses - event.baseline.passCount;
    const addOrders = targetCapturedOrders - event.baseline.capturedOrderCount;
    if (addOrders <= 0 || addPasses < addOrders || addPasses > addOrders * 4) throw new Error(`Event ${event.id}: existing volume cannot be topped up within approved targets.`);
    const quantities = Array(addOrders).fill(1);
    let remaining = addPasses - addOrders;
    const available = quantities.map((_, index) => index);
    while (remaining > 0) {
      const pick = Math.floor(random() * available.length);
      const index = available[pick];
      quantities[index]++;
      if (quantities[index] === 4) available.splice(pick, 1);
      remaining--;
    }
    const capacity = new Map(event.tickets.map(ticket => [ticket.id, ticket.quantityLimit === null ? Infinity : ticket.quantityLimit - ticket.occupied]));
    const ticketWeight = ticket => /weekend/i.test(ticket.name) ? 48 : /saturday/i.test(ticket.name) ? 32 : 20;
    const orders = quantities.map((quantity, index) => {
      const counts = new Map();
      // Families mostly buy one pass type; some combine day/weekend selections.
      let chosen;
      for (let unit = 0; unit < quantity; unit++) {
        const candidates = event.tickets.filter(ticket => capacity.get(ticket.id) > 0);
        if (!candidates.length) throw new Error(`Event ${event.id}: ticket quantity limits cannot accommodate target.`);
        if (!chosen || capacity.get(chosen.id) === 0 || random() < 0.12) chosen = chooseWeighted(candidates, random, ticketWeight);
        counts.set(chosen.id, (counts.get(chosen.id) ?? 0) + 1);
        capacity.set(chosen.id, capacity.get(chosen.id) - 1);
      }
      const items = [...counts].map(([id, count]) => ({ ticketId: id, quantity: count, ...event.tickets.filter(ticket => ticket.id === id).map(ticket => ({ name: ticket.name, unitCents: ticket.priceCents, validFrom: ticket.validFrom, validUntil: ticket.validUntil }))[0] }));
      const nameIndex = (index * 137 + event.id * 31) % (FIRST.length * LAST.length);
      return {
        email: `${MARKER}e${event.id}-${String(index + 1).padStart(3, "0")}@example.com`,
        buyer: `${FIRST[nameIndex % FIRST.length]} ${LAST[Math.floor(nameIndex / FIRST.length)]}`,
        team: TEAMS[Math.floor(random() * TEAMS.length)],
        at: timestampFor(event, items, random, cutoff),
        amountCents: items.reduce((sum, item) => sum + item.quantity * item.unitCents, 0), items,
      };
    });
    return { ...event, targetPasses, targetCapturedOrders, orders };
  });
  return { project: PROJECT_ID, environment: "test", marker: MARKER, asOf: CUTOFF, events };
}

export function preview(manifest) {
  return {
    project: manifest.project, environment: "test", cutoff: manifest.asOf,
    effects: "INSERT-only sample orders/items/unscanned passes. No Stripe charges, emails, scans, new events, or existing-row changes.",
    events: manifest.events.map(event => ({
      id: event.id, name: event.name, dates: [event.startDate, event.endDate],
      existingOrders: event.baseline.orderCount, addedOrders: event.orders.length,
      finalCapturedOrders: event.targetCapturedOrders, finalPasses: event.targetPasses,
      addedPasses: event.orders.reduce((sum, order) => sum + order.items.reduce((n, item) => n + item.quantity, 0), 0),
      addedRevenue: event.orders.reduce((sum, order) => sum + order.amountCents, 0) / 100,
      ticketSplits: event.tickets.map(ticket => ({ id: ticket.id, name: ticket.name, addedPasses: event.orders.flatMap(order => order.items).filter(item => item.ticketId === ticket.id).reduce((sum, item) => sum + item.quantity, 0) })),
      datesOfOrders: [...new Set(event.orders.map(order => new Intl.DateTimeFormat("en-CA", { timeZone: event.timeZone }).format(new Date(order.at))))].sort(),
    })),
  };
}

export function generateSql(manifest) {
  const encoded = q(JSON.stringify(manifest));
  return `-- Reviewed staging-only sample top-up. Pinned Supabase project: ${PROJECT_ID}.
-- No network, email, scan, event-creation, update, or delete operation exists here.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $volume$
declare
  v_manifest jsonb := ${encoded}::jsonb;
  v_event jsonb; v_spec jsonb; v_item jsonb; v_hashes jsonb;
  v_event_id bigint; v_order bigint; v_item_id bigint; v_markers bigint;
  v_expected_passes bigint; v_expected_items bigint;
begin
  perform pg_advisory_xact_lock(hashtext('tournibase:approved-volume:20261017'));
  if now() < ${q(CUTOFF)}::timestamptz then raise exception 'Refusing future-dated fixture.'; end if;
  if not exists (select 1 from public.organizations o join public.users u on u.id=o.owner_user_id
    join public.organization_stripe_accounts sa on sa.organization_id=o.id
    where o.id=${ORGANIZATION_ID} and o.owner_user_id=${q(OWNER_ID)}::uuid and lower(u.email)='lsautomates@gmail.com'
      and o.operating_environment='test' and sa.stripe_environment='test' and sa.stripe_account_id=${q(CONNECTED_ACCOUNT)})
    then raise exception 'Refusing nonmatching staging organization/owner/Stripe routing.'; end if;
  for v_event in select value from jsonb_array_elements(v_manifest->'events') loop
    v_event_id := (v_event->>'id')::bigint;
    perform 1 from public.tournaments where id=v_event_id and organization_id=${ORGANIZATION_ID} for update;
    if not found then raise exception 'Approved event % missing or moved.',v_event_id; end if;
    v_hashes := ${fingerprintSql("v_event_id")};
    if v_hashes <> v_event->'hashes' then raise exception 'Event % changed since reviewed pre-seed snapshot.',v_event_id; end if;
    select count(*) into v_markers from public.orders o where o.tournament_id=v_event_id and ${markerCondition("o")};
    if v_markers not in (0,jsonb_array_length(v_event->'orders')) then raise exception 'Incomplete/colliding seed markers in event %.',v_event_id; end if;
    if v_markers=0 then
      if (select count(*) from public.orders where tournament_id=v_event_id) <> (v_event->'baseline'->>'orderCount')::bigint
        or (select count(*) from public.passes where tournament_id=v_event_id) <> (v_event->'baseline'->>'passCount')::bigint
        then raise exception 'Baseline counts changed in event %.',v_event_id; end if;
      for v_spec in select value from jsonb_array_elements(v_event->'orders') loop
        insert into public.orders(tournament_id,buyer_name,buyer_email,buyer_team_name,amount_total,payment_status,
          stripe_environment,stripe_connected_account_id,platform_fee_amount,platform_fee_refunded,created_at)
        values(v_event_id,v_spec->>'buyer',v_spec->>'email',v_spec->>'team',(v_spec->>'amountCents')::numeric/100,
          'paid','test',${q(CONNECTED_ACCOUNT)},0,0,(v_spec->>'at')::timestamptz) returning id into v_order;
        for v_item in select value from jsonb_array_elements(v_spec->'items') loop
          insert into public.order_items(order_id,tournament_id,ticket_type_id,ticket_name,unit_amount_cents,quantity,valid_from,valid_until,created_at)
          values(v_order,v_event_id,(v_item->>'ticketId')::bigint,v_item->>'name',(v_item->>'unitCents')::integer,
            (v_item->>'quantity')::integer,(v_item->>'validFrom')::timestamptz,(v_item->>'validUntil')::timestamptz,(v_spec->>'at')::timestamptz)
          returning id into v_item_id;
          insert into public.passes(order_id,tournament_id,ticket_type_id,order_item_id,sequence_number,status,valid_from,valid_until,uses_allowed,created_at)
          select v_order,v_event_id,(v_item->>'ticketId')::bigint,v_item_id,n,'active',(v_item->>'validFrom')::timestamptz,
            (v_item->>'validUntil')::timestamptz,1,(v_spec->>'at')::timestamptz from generate_series(1,(v_item->>'quantity')::integer) n;
        end loop;
      end loop;
    end if;
    -- Validate both fresh inserts and completed reruns against the exact manifest.
    for v_spec in select value from jsonb_array_elements(v_event->'orders') loop
      select id into strict v_order from public.orders where tournament_id=v_event_id and buyer_email=v_spec->>'email';
      if not exists(select 1 from public.orders o where o.id=v_order and o.buyer_name=v_spec->>'buyer' and o.buyer_team_name=v_spec->>'team'
        and o.amount_total=(v_spec->>'amountCents')::numeric/100 and o.payment_status='paid' and o.stripe_environment='test'
        and o.stripe_connected_account_id=${q(CONNECTED_ACCOUNT)} and o.amount_refunded=0 and o.platform_fee_amount=0 and o.platform_fee_refunded=0
        and o.stripe_checkout_id is null and o.stripe_payment_intent_id is null and o.stripe_charge_id is null and o.inventory_expires_at is null
        and o.created_at=(v_spec->>'at')::timestamptz and o.created_at<=${q(CUTOFF)}::timestamptz)
        then raise exception 'Seed order % is not an unchanged synthetic order.',v_order; end if;
      v_expected_passes := 0; v_expected_items := 0;
      for v_item in select value from jsonb_array_elements(v_spec->'items') loop
        v_expected_items := v_expected_items+1;
        v_expected_passes := v_expected_passes+(v_item->>'quantity')::integer;
        select id into strict v_item_id from public.order_items where order_id=v_order and tournament_id=v_event_id
          and ticket_type_id=(v_item->>'ticketId')::bigint and ticket_name=v_item->>'name' and unit_amount_cents=(v_item->>'unitCents')::integer
          and quantity=(v_item->>'quantity')::integer and valid_from=(v_item->>'validFrom')::timestamptz
          and valid_until=(v_item->>'validUntil')::timestamptz and created_at=(v_spec->>'at')::timestamptz;
        if (select count(*) from public.passes p where p.order_item_id=v_item_id and p.order_id=v_order and p.tournament_id=v_event_id
          and p.ticket_type_id=(v_item->>'ticketId')::bigint and p.sequence_number between 1 and (v_item->>'quantity')::integer and p.status='active'
          and p.valid_from=(v_item->>'validFrom')::timestamptz and p.valid_until=(v_item->>'validUntil')::timestamptz
          and p.uses_allowed=1 and p.created_at=(v_spec->>'at')::timestamptz) <> (v_item->>'quantity')::integer
          then raise exception 'Seed pass mismatch for order item %.',v_item_id; end if;
      end loop;
      if (select count(*) from public.order_items where order_id=v_order) <> v_expected_items
        or (select count(*) from public.passes where order_id=v_order) <> v_expected_passes
        then raise exception 'Extra/missing items or passes for order %.',v_order; end if;
    end loop;
    if (select count(*) from public.orders o where o.tournament_id=v_event_id and ${markerCondition("o")}) <> jsonb_array_length(v_event->'orders')
      or (select count(*) from public.passes where tournament_id=v_event_id) <> (v_event->>'targetPasses')::bigint
      or (select count(*) from public.orders where tournament_id=v_event_id and payment_status in ('paid','partial_refund','refunded')) <> (v_event->>'targetCapturedOrders')::bigint
      or exists(select 1 from public.order_email_deliveries d join public.orders o on o.id=d.order_id where o.tournament_id=v_event_id and ${markerCondition("o")})
      or exists(select 1 from public.check_ins ci join public.passes p on p.id=ci.pass_id join public.orders o on o.id=p.order_id where o.tournament_id=v_event_id and ${markerCondition("o")})
      then raise exception 'Seed totals/side-effect validation failed for event %.',v_event_id; end if;
    v_hashes := ${fingerprintSql("v_event_id")};
    if v_hashes <> v_event->'hashes' then raise exception 'An existing row changed in event %.',v_event_id; end if;
  end loop;
end;
$volume$;
commit;
select t.id,t.name,count(distinct o.id) as orders,count(distinct p.id) as passes
from public.tournaments t left join public.orders o on o.tournament_id=t.id left join public.passes p on p.order_id=o.id
where t.id in (${EVENT_IDS.join(",")}) group by t.id,t.name order by t.id;
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--snapshot-query")) {
    console.log(snapshotQuery());
  } else {
    const path = process.argv[process.argv.indexOf("--snapshot") + 1];
    if (!process.argv.includes("--snapshot") || !path || path.startsWith("--")) throw new Error("Use --snapshot-query first, then --snapshot <reviewed.json> --preview or --sql.");
    const manifest = buildManifest(JSON.parse(readFileSync(path, "utf8")));
    console.log(process.argv.includes("--sql") ? generateSql(manifest) : JSON.stringify(preview(manifest), null, 2));
  }
}
