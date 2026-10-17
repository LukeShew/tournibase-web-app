-- One-time, user-requested staging sample variation. Project: khwaafsdtgiymucppkmo.
-- Three additional synthetic orders / eight unscanned passes; no Stripe calls,
-- emails, updates, deletes, price/date changes, or application-code changes.
-- Exact before-state fingerprints deliberately prevent rerunning this operation.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $variation$
declare
  expected jsonb := '{"items":"f8fb90235eeb2fa3d97125106ed76916","emails":"aa276ad3dc20cc05512191e19194fad8","orders":"0a7cfcbd40bd2f629df6e7fc4d2c1a49","passes":"d3fdb30ed25355eb61263f1bec0bec61","tickets":"cdd2ef647c7986832a4cf45b6310b339","checkIns":"4b7d87bfdf650296eba62bfef3f119b5","scanners":"723be5d46e0bb8dae01f41b294a6840d","manualSales":"542f19e9bc6336c99e1e2cc98c75e0e9","tournaments":"9fad420348b27bdc50454e4ac392e3db"}'::jsonb;
  specs jsonb := '[
    {"event":3,"buyer":"Alex Bennett","team":"Triangle United","at":"2026-07-15T22:43:00Z","amount":15,"items":[{"ticket":9,"quantity":1,"price":15}]},
    {"event":5,"buyer":"Morgan Reed","team":"Piedmont Hoops","at":"2026-09-17T16:27:00Z","amount":72,"items":[{"ticket":14,"quantity":4,"price":18}]},
    {"event":6,"buyer":"Casey Foster","team":"Queen City Elite","at":"2026-10-14T23:18:00Z","amount":64,"items":[{"ticket":16,"quantity":1,"price":28},{"ticket":17,"quantity":2,"price":18}]}
  ]'::jsonb;
  before_or_after integer;
  actual jsonb;
  spec jsonb;
  item jsonb;
  ticket public.ticket_types%rowtype;
  new_order bigint;
  new_item bigint;
  added_orders bigint[] := '{}'::bigint[];
  occupied bigint;
begin
  perform pg_advisory_xact_lock(hashtext('tournibase:sample-variation:20261017'));
  if not exists (
    select 1 from public.organizations o
    join public.users u on u.id=o.owner_user_id
    join public.organization_stripe_accounts sa on sa.organization_id=o.id
    where o.id=1 and o.owner_user_id='c64721a2-024e-4019-a9db-9072fd330a8a'::uuid
      and lower(u.email)='lsautomates@gmail.com' and o.operating_environment='test'
      and sa.stripe_environment='test' and sa.stripe_account_id='acct_1Tui4qBDCykX1MuY'
  ) then raise exception 'Refusing nonmatching staging organization/owner/Stripe routing.'; end if;

  for before_or_after in 0..1 loop
    -- Post-insert fingerprints exclude only the exact rows inserted here.
    select jsonb_build_object(
      'tournaments',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.tournaments x),
      'tickets',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.ticket_types x),
      'orders',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.orders x where not(x.id=any(added_orders))),
      'items',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.order_items x where not(x.order_id=any(added_orders))),
      'passes',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.passes x where not(x.order_id=any(added_orders))),
      'scanners',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.scanner_sessions x),
      'checkIns',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.check_ins x),
      'manualSales',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.manual_sales x),
      'emails',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.order_id),'[]'::jsonb)::text) from public.order_email_deliveries x)
    ) into actual;
    if actual <> expected then
      raise exception 'Existing data changed; refusing stale snapshot or side effects (phase %).',before_or_after;
    end if;
    if before_or_after=1 then exit; end if;

    for spec in select value from jsonb_array_elements(specs) loop
      perform 1 from public.tournaments where id=(spec->>'event')::bigint and organization_id=1 for update;
      if not found or (spec->>'at')::timestamptz > now() then
        raise exception 'Event moved/missing or future order timestamp.';
      end if;
      if exists(select 1 from public.orders where buyer_email='variation-20261017-e'||(spec->>'event')||'@example.com') then
        raise exception 'Sample marker already exists; do not rerun.';
      end if;
      insert into public.orders(tournament_id,buyer_name,buyer_email,buyer_team_name,amount_total,payment_status,
        stripe_environment,stripe_connected_account_id,platform_fee_amount,platform_fee_refunded,created_at)
      values((spec->>'event')::bigint,spec->>'buyer','variation-20261017-e'||(spec->>'event')||'@example.com',
        spec->>'team',(spec->>'amount')::numeric,'paid','test','acct_1Tui4qBDCykX1MuY',0,0,(spec->>'at')::timestamptz)
      returning id into new_order;
      added_orders := array_append(added_orders,new_order);
      for item in select value from jsonb_array_elements(spec->'items') loop
        select * into strict ticket from public.ticket_types
          where id=(item->>'ticket')::bigint and tournament_id=(spec->>'event')::bigint for update;
        if ticket.status <> 'active' or ticket.price <> (item->>'price')::numeric
          or ticket.valid_until <= (spec->>'at')::timestamptz
          or (item->>'quantity')::integer not between 1 and 4 then
          raise exception 'Ticket price/status/window/quantity mismatch.';
        end if;
        select coalesce((select sum(oi.quantity) from public.order_items oi join public.orders o on o.id=oi.order_id
          where oi.ticket_type_id=ticket.id and (o.payment_status in ('paid','partial_refund')
            or (o.payment_status='pending' and o.inventory_expires_at>now()))),0)
          +coalesce((select sum(ms.quantity) from public.manual_sales ms where ms.ticket_type_id=ticket.id),0) into occupied;
        if ticket.quantity_limit is not null and occupied+(item->>'quantity')::integer > ticket.quantity_limit then
          raise exception 'Ticket capacity would be exceeded.';
        end if;
        insert into public.order_items(order_id,tournament_id,ticket_type_id,ticket_name,unit_amount_cents,quantity,valid_from,valid_until,created_at)
        values(new_order,ticket.tournament_id,ticket.id,ticket.name,(ticket.price*100)::integer,(item->>'quantity')::integer,
          ticket.valid_from,ticket.valid_until,(spec->>'at')::timestamptz) returning id into new_item;
        insert into public.passes(order_id,tournament_id,ticket_type_id,order_item_id,sequence_number,status,valid_from,valid_until,uses_allowed,created_at)
        select new_order,ticket.tournament_id,ticket.id,new_item,n,'active',ticket.valid_from,ticket.valid_until,1,(spec->>'at')::timestamptz
          from generate_series(1,(item->>'quantity')::integer) n;
      end loop;
    end loop;
  end loop;

  if cardinality(added_orders) <> 3
    or (select count(*) from public.order_items where order_id=any(added_orders)) <> 4
    or (select count(*) from public.passes where order_id=any(added_orders)) <> 8
    or (select sum(amount_total) from public.orders where id=any(added_orders)) <> 151
    or exists(select 1 from public.orders o where o.id=any(added_orders) and (
      o.amount_total*100 <> (select sum(oi.unit_amount_cents*oi.quantity) from public.order_items oi where oi.order_id=o.id)
      or o.payment_status <> 'paid' or o.stripe_environment <> 'test' or o.stripe_connected_account_id <> 'acct_1Tui4qBDCykX1MuY'
      or o.stripe_checkout_id is not null or o.stripe_payment_intent_id is not null or o.stripe_charge_id is not null
      or o.platform_fee_amount <> 0 or o.platform_fee_refunded <> 0 or o.amount_refunded <> 0))
    or exists(select 1 from public.order_items oi where oi.order_id=any(added_orders)
      and oi.quantity <> (select count(*) from public.passes p where p.order_item_id=oi.id and p.order_id=oi.order_id
        and p.tournament_id=oi.tournament_id and p.ticket_type_id=oi.ticket_type_id and p.status='active'
        and p.valid_from=oi.valid_from and p.valid_until=oi.valid_until and p.uses_allowed=1
        and p.created_at=oi.created_at and p.sequence_number between 1 and oi.quantity))
    or exists(select 1 from public.order_email_deliveries where order_id=any(added_orders))
    or exists(select 1 from public.check_ins ci join public.passes p on p.id=ci.pass_id where p.order_id=any(added_orders))
    then raise exception 'New sample data failed money/pass-count/routing/side-effect checks.'; end if;
end;
$variation$;
commit;
