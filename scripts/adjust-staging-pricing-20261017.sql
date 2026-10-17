-- One-time user-approved sample pricing variation. Supabase khwaafsdtgiymucppkmo.
-- TEST organization only. Reprice known synthetic, unemailed paid orders and
-- their line items consistently with the sample ticket catalog. Never alter
-- any Stripe transaction, sent receipt, routing/fees, pass, or admission record.
-- Historical before-state fingerprints prevent reruns. Do not refresh them.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $pricing$
declare
  expected jsonb := '{"items":"b94231c9204f5cd059315ce88fbeb8c4","emails":"aa276ad3dc20cc05512191e19194fad8","orders":"9881bcab1e06dab1cd04f24acfe0611f","tickets":"cdd2ef647c7986832a4cf45b6310b339"}'::jsonb;
  prices jsonb := '[{"id":1,"cents":975},{"id":2,"cents":1125},{"id":3,"cents":1649},{"id":7,"cents":1249},{"id":8,"cents":1095},{"id":9,"cents":1875},{"id":10,"cents":1725},{"id":11,"cents":1195},{"id":12,"cents":1049},{"id":13,"cents":2975},{"id":14,"cents":1849},{"id":15,"cents":1795},{"id":16,"cents":2875},{"id":17,"cents":1895},{"id":18,"cents":1749}]'::jsonb;
  targets jsonb := '[{"id":1,"gross":12615.19},{"id":3,"gross":14925.09},{"id":4,"gross":14009.29},{"id":5,"gross":22154.65},{"id":6,"gross":20467.68}]'::jsonb;
  actual jsonb; normalized jsonb; original_normalized jsonb;
  eligible bigint[]; ticket_ids bigint[]; spec jsonb;
  phase integer; affected integer;
begin
  perform pg_advisory_xact_lock(hashtext('tournibase:sample-pricing:20261017'));
  if not exists(select 1 from public.organizations org join public.users u on u.id=org.owner_user_id
    join public.organization_stripe_accounts sa on sa.organization_id=org.id
    where org.id=1 and org.owner_user_id='c64721a2-024e-4019-a9db-9072fd330a8a'::uuid
      and lower(u.email)='lsautomates@gmail.com' and org.operating_environment='test'
      and sa.stripe_environment='test' and sa.stripe_account_id='acct_1Tui4qBDCykX1MuY') then
    raise exception 'Refusing nonmatching staging owner/environment/Stripe account.';
  end if;
  select jsonb_build_object(
    'orders',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.orders x),
    'items',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.order_items x),
    'tickets',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.ticket_types x),
    'emails',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.order_id),'[]'::jsonb)::text) from public.order_email_deliveries x)
  ) into actual;
  if actual <> expected then raise exception 'Stale pricing snapshot; do not rerun or overwrite new activity.'; end if;

  select array_agg(o.id order by o.id) into eligible
  from public.orders o join public.tournaments t on t.id=o.tournament_id
  join public.organizations org on org.id=t.organization_id
  where org.id=1 and org.operating_environment='test' and t.id in(1,3,4,5,6)
    and o.stripe_environment='test' and o.stripe_connected_account_id='acct_1Tui4qBDCykX1MuY'
    and (o.buyer_email ~ '^(volume|variation)-20261017-e(1|3|4|5|6)-?[0-9]*@example[.]com$'
      or (t.id=5 and o.buyer_email ~ '^showcase-demo-[0-9]{3}@example[.]com$'))
    and o.payment_status='paid' and o.amount_refunded=0 and o.platform_fee_amount=0 and o.platform_fee_refunded=0
    and o.stripe_checkout_id is null and o.stripe_payment_intent_id is null and o.stripe_charge_id is null
    and not exists(select 1 from public.order_email_deliveries d where d.order_id=o.id);
  if cardinality(eligible) is distinct from 1915 then raise exception 'Unexpected eligible sample-order set.'; end if;
  select array_agg((value->>'id')::bigint order by (value->>'id')::bigint) into ticket_ids from jsonb_array_elements(prices);
  if cardinality(ticket_ids) <> 15 or (select count(*) from public.ticket_types tt join public.tournaments t on t.id=tt.tournament_id
      where tt.id=any(ticket_ids) and t.organization_id=1 and t.id in(1,3,4,5,6) and tt.status='active') <> 15 then
    raise exception 'Sample ticket catalog mismatch.';
  end if;
  perform 1 from public.orders where id=any(eligible) for update;
  perform 1 from public.order_items where order_id=any(eligible) for update;
  perform 1 from public.ticket_types where id=any(ticket_ids) for update;
  -- Lock waits must not accept a newly queued receipt or changed order/catalog
  -- as the baseline. Referencing receipt inserts also conflict with order locks.
  select jsonb_build_object(
    'orders',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.orders x),
    'items',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.order_items x),
    'tickets',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb)::text) from public.ticket_types x),
    'emails',(select md5(coalesce(jsonb_agg(to_jsonb(x) order by x.order_id),'[]'::jsonb)::text) from public.order_email_deliveries x)
  ) into actual;
  if actual <> expected then raise exception 'Pricing snapshot changed while waiting for locks.'; end if;
  if exists(select 1 from public.order_items oi where oi.order_id=any(eligible) and not(oi.ticket_type_id=any(ticket_ids)))
    or exists(select 1 from public.order_items oi join public.ticket_types tt on tt.id=oi.ticket_type_id
      where oi.order_id=any(eligible) and oi.unit_amount_cents <> tt.price*100)
    or exists(select 1 from public.orders o where o.id=any(eligible) and o.amount_total*100 is distinct from
      (select sum(oi.quantity*oi.unit_amount_cents) from public.order_items oi where oi.order_id=o.id)) then
    raise exception 'Existing synthetic items/amounts do not reconcile.';
  end if;

  for phase in 0..1 loop
    -- Every field other than the explicitly authorized prices/totals is frozen.
    -- All protected Stripe/emailed orders retain full-row fingerprints.
    select jsonb_build_object(
      'orders',(select md5(jsonb_agg(case when x.id=any(eligible) then to_jsonb(x)-'amount_total' else to_jsonb(x) end order by x.id)::text) from public.orders x),
      'items',(select md5(jsonb_agg(case when x.order_id=any(eligible) then to_jsonb(x)-'unit_amount_cents' else to_jsonb(x) end order by x.id)::text) from public.order_items x),
      'tickets',(select md5(jsonb_agg(case when x.id=any(ticket_ids) then to_jsonb(x)-'price' else to_jsonb(x) end order by x.id)::text) from public.ticket_types x),
      'tournaments',(select md5(jsonb_agg(to_jsonb(x) order by x.id)::text) from public.tournaments x),
      'passes',(select md5(jsonb_agg(to_jsonb(x) order by x.id)::text) from public.passes x),
      'check_ins',(select md5(jsonb_agg(to_jsonb(x) order by x.id)::text) from public.check_ins x),
      'scanners',(select md5(jsonb_agg(to_jsonb(x) order by x.id)::text) from public.scanner_sessions x),
      'manual_sales',(select md5(jsonb_agg(to_jsonb(x) order by x.id)::text) from public.manual_sales x),
      'emails',(select md5(jsonb_agg(to_jsonb(x) order by x.order_id)::text) from public.order_email_deliveries x)
    ) into normalized;
    if phase=1 then
      if normalized <> original_normalized then raise exception 'Protected data changed during repricing.'; end if;
      exit;
    end if;
    original_normalized := normalized;

    for spec in select value from jsonb_array_elements(prices) loop
      update public.ticket_types set price=(spec->>'cents')::numeric/100 where id=(spec->>'id')::bigint;
      update public.order_items set unit_amount_cents=(spec->>'cents')::integer
        where ticket_type_id=(spec->>'id')::bigint and order_id=any(eligible);
    end loop;
    update public.orders o set amount_total=(select sum(oi.quantity*oi.unit_amount_cents)::numeric/100
      from public.order_items oi where oi.order_id=o.id) where o.id=any(eligible);
    get diagnostics affected=row_count;
    if affected <> 1915 then raise exception 'Unexpected repriced order count.'; end if;
  end loop;

  if exists(select 1 from public.orders o where o.id=any(eligible) and o.amount_total*100 is distinct from
      (select sum(oi.quantity*oi.unit_amount_cents) from public.order_items oi where oi.order_id=o.id))
    or exists(select 1 from public.order_items oi join public.ticket_types tt on tt.id=oi.ticket_type_id
      where oi.order_id=any(eligible) and oi.unit_amount_cents <> tt.price*100) then
    raise exception 'Final item/order/catalog prices do not reconcile.';
  end if;
  for spec in select value from jsonb_array_elements(targets) loop
    if (select sum(amount_total) from public.orders where tournament_id=(spec->>'id')::bigint
        and payment_status in('paid','partial_refund','refunded')) is distinct from (spec->>'gross')::numeric then
      raise exception 'Unexpected final event gross for %.',spec->>'id';
    end if;
  end loop;
end;
$pricing$;
commit;
