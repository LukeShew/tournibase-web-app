/** One-time approved staging event. Offline preview/SQL only; no network calls.
 * Applied snapshot guards must not be refreshed to rerun a completed seed.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const project = "khwaafsdtgiymucppkmo";
const slug = "piedmont-summer-tip-off-2026";
const baseline = { items:"44cd916dbcb4fa11dbd6191fc7066a00", emails:"aa276ad3dc20cc05512191e19194fad8", orders:"8a253cd7f028f0f5fd88e28f9e340acc", passes:"55e0ced4cbcaf82a2d30abc18584e33b", tickets:"ab2d0704164f4669a412343bc0105689", checkIns:"f4f65da2234a775c9172315dc78058ef", scanners:"aa3e53b04785c40a6f36555e96e0bdd8", manualSales:"542f19e9bc6336c99e1e2cc98c75e0e9", tournaments:"9fad420348b27bdc50454e4ac392e3db" };
let counter = 0;
const random = () => createHash("sha256").update(`small-first-20261017:${counter++}`).digest().readUInt32BE() / 4294967296;
const pick = xs => xs[Math.floor(random()*xs.length)];
const tickets = [
  { name:"Saturday Pass", cents:875, from:"2026-06-27T12:00:00Z", until:"2026-06-28T01:00:00Z", days:[27] },
  { name:"Sunday Pass", cents:949, from:"2026-06-28T12:00:00Z", until:"2026-06-28T23:00:00Z", days:[28] },
  { name:"Weekend Pass", cents:1495, from:"2026-06-27T12:00:00Z", until:"2026-06-28T23:00:00Z", days:[27,28] },
];
const quantities = Array(79).fill(1);
for (let extra=0;extra<94;extra++) {
  const available = quantities.map((q,i)=>({q,i})).filter(x=>x.q<4);
  quantities[pick(available).i]++;
}
const first=["Jordan","Taylor","Morgan","Cameron","Alex","Casey","Riley","Jamie","Avery","Drew","Reese","Parker"];
const last=["Brooks","Carter","Davis","Evans","Foster","Gray","Hayes","James","King","Lewis","Miller","Nelson"];
const teams=["Piedmont Hoops","Carolina Storm","Triad Thunder","Blue Ridge Select","Queen City Elite","Coastal Flight"];
const orders=quantities.map((quantity,i)=>{
  const ticket=pick([0,0,0,1,1,2,2,2,2]);
  const spec=tickets[ticket];
  const allowed=Array.from({length:7},(_,d)=>d+22).filter(d=>d<=Math.max(...spec.days));
  const weighted=allowed.flatMap(d=>Array([3,13,21,24,19,12,6][d-22]).fill(d));
  const day=pick(weighted);
  const at=new Date(Date.UTC(2026,5,day,day>=27?11:13)+Math.floor(random()*(day>=27?7:10)*3600)*1000);
  const arrivalDays=spec.days.filter(d=>d>=day);
  const admissionDay=pick(arrivalDays);
  const opening=Date.UTC(2026,5,admissionDay,12);
  const wave=pick([0,0,0,0,1,1,2]);
  const proposed=opening+[0,2.3,5][wave]*3600000+Math.floor(random()*1.5*3600000);
  const admittedAt=new Date(Math.max(at.getTime()+180000,proposed));
  return {n:i+1,ticket,quantity,at:at.toISOString(),admittedAt:admittedAt.toISOString(),
    buyer:`${first[i%first.length]} ${last[Math.floor(i/first.length)%last.length]}`,
    team:pick(teams),manual:random()<0.045};
});
// Leave whole families totaling 16 tickets as no-shows; all other parties attend.
const subsets=new Map([[0,[]]]);
for(const o of orders) {
  for(const [sum,ids] of [...subsets].sort((a,b)=>b[0]-a[0])) {
    if(sum+o.quantity<=16 && !subsets.has(sum+o.quantity)) subsets.set(sum+o.quantity,[...ids,o.n]);
  }
  if(subsets.has(16)) break;
}
const absent=new Set(subsets.get(16));
for(const o of orders) o.attended=!absent.has(o.n);
const grossCents=orders.reduce((sum,o)=>sum+o.quantity*tickets[o.ticket].cents,0);
assert.equal(orders.length,79);
assert.equal(orders.reduce((s,o)=>s+o.quantity,0),173);
assert.equal(orders.filter(o=>o.attended).reduce((s,o)=>s+o.quantity,0),157);
assert.notEqual(grossCents%100,0);
for(const o of orders) {
  assert.ok(Date.parse(o.admittedAt)>=Date.parse(o.at)+180000);
  assert.ok(Date.parse(o.admittedAt)>=Date.parse(tickets[o.ticket].from));
  assert.ok(Date.parse(o.admittedAt)<=Date.parse(tickets[o.ticket].until));
  assert.ok(new Date(o.admittedAt).getUTCHours()<22);
}
const q = value => `'${String(value).replaceAll("'","''")}'`;
const hash = (table,filter="true",sort="id") => `(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.${sort}),'[]'::jsonb)::text) from public.${table} x where ${filter})`;
const fingerprints=`jsonb_build_object('tournaments',${hash("tournaments","x.id<>event_id")},'tickets',${hash("ticket_types","x.tournament_id<>event_id")},'orders',${hash("orders","x.tournament_id<>event_id")},'items',${hash("order_items","x.tournament_id<>event_id")},'passes',${hash("passes","x.tournament_id<>event_id")},'scanners',${hash("scanner_sessions","x.tournament_id<>event_id")},'checkIns',${hash("check_ins","x.tournament_id<>event_id")},'manualSales',${hash("manual_sales","x.tournament_id<>event_id")},'emails',${hash("order_email_deliveries","true","order_id")})`;
const sql=`-- Project ${project}; one-time user-requested staging sample. Never rerun.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $small$
declare
  expected jsonb:=${q(JSON.stringify(baseline))}::jsonb;
  specs jsonb:=${q(JSON.stringify(orders))}::jsonb;
  event_id bigint:=0; ticket_ids bigint[]:='{}'; scanner_ids bigint[]:='{}';
  new_id bigint; order_id bigint; item_id bigint; pass_id bigint; spec jsonb; tt record;
  seq integer; day integer; phase integer; scan_at timestamptz; owner_id uuid:='c64721a2-024e-4019-a9db-9072fd330a8a';
begin
  perform pg_advisory_xact_lock(hashtext('tournibase:small-first:20261017'));
  if not exists(select 1 from public.organizations org join public.users u on u.id=org.owner_user_id
    join public.organization_stripe_accounts sa on sa.organization_id=org.id
    where org.id=1 and org.owner_user_id=owner_id and lower(u.email)='lsautomates@gmail.com'
      and org.operating_environment='test' and sa.stripe_environment='test' and sa.stripe_account_id='acct_1Tui4qBDCykX1MuY')
    or exists(select 1 from public.tournaments where public_slug=${q(slug)})
    then raise exception 'Wrong staging routing or event already exists.'; end if;
  for phase in 0..1 loop
    if ${fingerprints} <> expected then raise exception 'Stale snapshot or existing data changed (phase %).',phase; end if;
    if phase=1 then exit; end if;
    insert into public.tournaments(organization_id,name,sport,start_date,end_date,venue_name,venue_address,
      organizer_name,contact_email,description,status,public_slug,time_zone,created_at)
    values(1,'Piedmont Summer Tip-Off','youth_basketball','2026-06-27','2026-06-28','Piedmont Community Center',
      'Greensboro, NC','Luke Events','events@example.com',
      'A two-day youth basketball tournament with Saturday pool play and Sunday bracket games. Spectator admission is available by day or for the full weekend.',
      'published',${q(slug)},'America/New_York','2026-06-15T14:23:00Z') returning id into event_id;
    ${tickets.map(t=>`insert into public.ticket_types(tournament_id,name,price,valid_from,valid_until,status,created_at)
      values(event_id,${q(t.name)},${t.cents}/100.0,${q(t.from)},${q(t.until)},'active','2026-06-15T14:27:00Z') returning id into new_id;
      ticket_ids:=array_append(ticket_ids,new_id);`).join("\n")}
    for day in 27..28 loop
      insert into public.scanner_sessions(tournament_id,gate_name,token_hash,permissions,expires_at,staff_label,created_by,created_at,last_active_at,revoked_at)
      values(event_id,'Main Entrance',md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text),array['scan'],
        make_timestamptz(2026,6,day,21,0,0,'America/New_York'),'Admission Team',owner_id,
        make_timestamptz(2026,6,day,7,0,0,'America/New_York'),null,
        make_timestamptz(2026,6,day,21,0,0,'America/New_York')) returning id into new_id;
      scanner_ids:=array_append(scanner_ids,new_id);
    end loop;
    for spec in select value from jsonb_array_elements(specs) loop
      select * into strict tt from public.ticket_types where id=ticket_ids[(spec->>'ticket')::integer+1];
      insert into public.orders(tournament_id,buyer_name,buyer_email,buyer_team_name,amount_total,payment_status,
        stripe_environment,stripe_connected_account_id,platform_fee_amount,platform_fee_refunded,created_at)
      values(event_id,spec->>'buyer','piedmont-first-20261017-'||lpad(spec->>'n',3,'0')||'@example.com',spec->>'team',
        tt.price*(spec->>'quantity')::integer,'paid','test','acct_1Tui4qBDCykX1MuY',0,0,(spec->>'at')::timestamptz) returning id into order_id;
      insert into public.order_items(order_id,tournament_id,ticket_type_id,ticket_name,unit_amount_cents,quantity,valid_from,valid_until,created_at)
      values(order_id,event_id,tt.id,tt.name,(tt.price*100)::integer,(spec->>'quantity')::integer,tt.valid_from,tt.valid_until,(spec->>'at')::timestamptz)
      returning id into item_id;
      for seq in 1..(spec->>'quantity')::integer loop
        insert into public.passes(order_id,tournament_id,ticket_type_id,order_item_id,sequence_number,status,valid_from,valid_until,uses_allowed,created_at)
        values(order_id,event_id,tt.id,item_id,seq,case when (spec->>'attended')::boolean then 'checked_in'::public.pass_status else 'active'::public.pass_status end,
          tt.valid_from,tt.valid_until,1,(spec->>'at')::timestamptz) returning id into pass_id;
        if (spec->>'attended')::boolean then
          scan_at:=(spec->>'admittedAt')::timestamptz+make_interval(secs=>(seq-1)*2);
          if scan_at<greatest((spec->>'at')::timestamptz,tt.valid_from) or scan_at>tt.valid_until or scan_at>now()
            then raise exception 'Invalid admission timestamp.'; end if;
          day:=extract(day from scan_at at time zone 'America/New_York')::integer;
          if day not in(27,28) then raise exception 'Wrong admission day.'; end if;
          insert into public.check_ins(pass_id,tournament_id,scanner_session_id,gate_name,result,source,created_at)
          values(pass_id,event_id,scanner_ids[day-26],'Main Entrance',
            case when (spec->>'manual')::boolean then 'manual_check_in'::public.check_in_result else 'valid'::public.check_in_result end,
            case when (spec->>'manual')::boolean then 'manual' else 'camera' end,scan_at);
        end if;
      end loop;
    end loop;
  end loop;
  update public.scanner_sessions ss set last_active_at=(select max(c.created_at) from public.check_ins c where c.scanner_session_id=ss.id)
    where ss.tournament_id=event_id;
  if (select count(*) from public.orders o where o.tournament_id=event_id)<>79
    or (select sum(o.amount_total) from public.orders o where o.tournament_id=event_id)<>${grossCents}/100.0
    or (select count(*) from public.passes p where p.tournament_id=event_id)<>173
    or (select count(*) from public.passes p where p.tournament_id=event_id and p.status='checked_in')<>157
    or (select count(*) from public.check_ins c where c.tournament_id=event_id)<>157
    or exists(select 1 from public.orders o where o.tournament_id=event_id and (
      o.stripe_environment<>'test' or o.payment_status<>'paid' or o.stripe_checkout_id is not null
      or o.stripe_payment_intent_id is not null or o.stripe_charge_id is not null or o.platform_fee_amount<>0
      or o.amount_refunded<>0 or o.platform_fee_refunded<>0 or o.stripe_connected_account_id<>'acct_1Tui4qBDCykX1MuY'
      or o.amount_total*100 is distinct from(select sum(oi.quantity*oi.unit_amount_cents) from public.order_items oi where oi.order_id=o.id)))
    or exists(select 1 from public.order_items oi where oi.tournament_id=event_id and oi.quantity<>
      (select count(*) from public.passes p where p.order_item_id=oi.id))
    or exists(select 1 from public.scanner_sessions ss where ss.tournament_id=event_id and ss.revoked_at is null)
    or exists(select 1 from public.order_email_deliveries e join public.orders o on o.id=e.order_id where o.tournament_id=event_id)
    then raise exception 'New event integrity verification failed.'; end if;
end;
$small$;
commit;
select id,name,start_date,end_date,public_slug from public.tournaments where public_slug=${q(slug)};
`;
console.log(process.argv.includes("--sql")?sql:JSON.stringify({project,name:"Piedmont Summer Tip-Off",dates:["2026-06-27","2026-06-28"],orders:orders.length,passes:173,checkedIn:157,noShows:16,gross:grossCents/100,tickets:tickets.map(t=>({name:t.name,price:t.cents/100,quantity:orders.filter(o=>o.ticket===tickets.indexOf(t)).reduce((s,o)=>s+o.quantity,0)})),dailySales:Array.from({length:7},(_,i)=>({date:`2026-06-${22+i}`,amount:orders.filter(o=>o.at.startsWith(`2026-06-${22+i}`)).reduce((s,o)=>s+o.quantity*tickets[o.ticket].cents,0)/100}))},null,2));
