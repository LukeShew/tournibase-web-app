-- Run on a disposable migrated PostgreSQL/Supabase database. All fixture data
-- rolls back; this file makes no Stripe requests and sends no email.
begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_organization_id bigint;
  v_tournament_id bigint;
  v_ticket_id bigint;
  v_free_ticket_id bigint;
  v_small_ticket_id bigint;
  v_limited_ticket_id bigint;
  v_order_id bigint;
  v_legacy_order_id bigint;
  v_slug text := 'buyer-fee-regression-' || replace(gen_random_uuid()::text, '-', '');
  v_account text := 'acct_regression_' || replace(gen_random_uuid()::text, '-', '');
  v_result jsonb;
  v_metrics jsonb;
  v_row public.orders%rowtype;
  v_count bigint;
  v_denied boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user_id, v_user_id::text || '@example.invalid', '{"name":"Fee regression"}');
  insert into public.organizations (name, owner_user_id, operating_environment)
  values ('Fee regression', v_user_id, 'test') returning id into v_organization_id;
  insert into public.organization_stripe_accounts (
    organization_id, stripe_account_id, stripe_environment,
    onboarding_complete, charges_enabled, payouts_enabled,
    card_payments_status, payouts_status
  ) values (v_organization_id, v_account, 'test', true, true, true, 'active', 'active');
  insert into public.tournaments (
    organization_id, name, start_date, end_date, venue_name,
    organizer_name, contact_email, public_slug, status, time_zone
  ) values (
    v_organization_id, 'Fee regression', current_date, current_date + 2,
    'Fixture venue', 'Fee regression', 'regression@example.invalid',
    v_slug, 'published', 'UTC'
  ) returning id into v_tournament_id;
  insert into public.ticket_types (tournament_id, name, price, valid_from, valid_until)
  values (v_tournament_id, 'Admission', 10, current_date, current_date + 2)
  returning id into v_ticket_id;
  insert into public.ticket_types (tournament_id, name, price, valid_from, valid_until)
  values (v_tournament_id, 'Complimentary', 0, current_date, current_date + 2)
  returning id into v_free_ticket_id;
  insert into public.ticket_types (tournament_id, name, price, valid_from, valid_until)
  values (v_tournament_id, 'Low price', 0.10, current_date, current_date + 2)
  returning id into v_small_ticket_id;
  insert into public.ticket_types (
    tournament_id, name, price, valid_from, valid_until, quantity_limit
  ) values (v_tournament_id, 'Limited', 10, current_date, current_date + 2, 1)
  returning id into v_limited_ticket_id;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  assert has_function_privilege('service_role',
    'public.reserve_checkout_order_with_buyer_fee(text,text,text,text,text,jsonb,text,integer,integer,text)',
    'EXECUTE'), 'Service role must be able to reserve buyer-fee orders';
  assert not has_function_privilege('anon',
    'public.reserve_checkout_order_with_buyer_fee(text,text,text,text,text,jsonb,text,integer,integer,text)',
    'EXECUTE'), 'Anonymous clients cannot choose fee configuration';
  assert not has_function_privilege('authenticated',
    'public.reserve_checkout_order_with_buyer_fee(text,text,text,text,text,jsonb,text,integer,integer,text)',
    'EXECUTE'), 'Directors cannot call the privileged reservation RPC';
  assert not has_function_privilege('authenticated',
    'public.get_tournament_dashboard_metrics(bigint)', 'EXECUTE'),
    'Migration must not reopen the environment-unaware metrics RPC';
  assert not has_function_privilege('authenticated',
    'public.get_director_lifetime_revenue()', 'EXECUTE'),
    'Migration must not reopen the environment-unaware lifetime RPC';

  set local role service_role;
  v_result := public.reserve_checkout_order_with_buyer_fee(
    v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket_id, 'quantity', 1)),
    'test', 200, 30, 'test'
  );
  reset role;
  assert v_result->>'status' = 'reserved', 'Normal paid reservation failed';
  assert (v_result->>'ticket_subtotal_cents')::bigint = 1000;
  assert (v_result->>'buyer_fee_amount_cents')::bigint = 50;
  assert (v_result->>'platform_fee_amount_cents')::bigint = 50;
  assert (v_result->>'amount_total_cents')::bigint = 1050;
  assert jsonb_array_length(v_result->'items') = 1, 'Fee must not create an admission item';
  v_order_id := (v_result->>'order_id')::bigint;
  select * into v_row from public.orders where id = v_order_id;
  assert v_row.amount_total = 10.50 and v_row.buyer_fee_amount = 0.50
    and v_row.platform_fee_amount = 0.50 and v_row.buyer_fee_refunded = 0;

  v_result := public.reserve_checkout_order_with_buyer_fee(
    v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket_id, 'quantity', 2)),
    'test', 200, 30, 'test'
  );
  assert (v_result->>'ticket_subtotal_cents')::bigint = 2000
    and (v_result->>'buyer_fee_amount_cents')::bigint = 70
    and (v_result->>'amount_total_cents')::bigint = 2070,
    'The fixed fee is charged once per order, not once per ticket';

  v_result := public.reserve_checkout_order_with_buyer_fee(
    v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket_id, 'quantity', 1)),
    'test', 0, 0, 'test'
  );
  assert (v_result->>'amount_total_cents')::bigint = 1000
    and (v_result->>'buyer_fee_amount_cents')::bigint = 0,
    'Zero-fee environment configuration must keep the ticket-only total';

  v_result := public.reserve_checkout_order_with_buyer_fee(
    v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_small_ticket_id, 'quantity', 1)),
    'test', 200, 30, 'test'
  );
  assert (v_result->>'ticket_subtotal_cents')::bigint = 10
    and (v_result->>'buyer_fee_amount_cents')::bigint = 30
    and (v_result->>'amount_total_cents')::bigint = 40,
    'Buyer fee may exceed a tiny ticket subtotal';

  v_result := public.reserve_checkout_order_with_buyer_fee(
    v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_free_ticket_id, 'quantity', 1)),
    'test', 200, 30, 'test'
  );
  assert (v_result->>'amount_total_cents')::bigint = 0
    and (v_result->>'buyer_fee_amount_cents')::bigint = 0
    and v_result->>'stripe_connected_account_id' is null,
    'Free tickets must not incur the fixed fee or require paid routing';

  select count(*) into v_count from public.orders where tournament_id = v_tournament_id;
  v_result := public.reserve_checkout_order_with_buyer_fee(
    v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket_id, 'quantity', 1)),
    'live', 200, 30, 'live'
  );
  assert v_result->>'status' = 'event_unavailable', 'Cross-environment reservation must fail';
  v_result := public.reserve_checkout_order_with_buyer_fee(
    v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket_id, 'quantity', 1)),
    'test', -1, 30, 'test'
  );
  assert v_result->>'status' = 'invalid_request', 'Negative fee configuration must fail';
  assert (select count(*) from public.orders where tournament_id = v_tournament_id) = v_count,
    'Invalid reservations must not leave orders behind';

  v_result := public.reserve_checkout_order_with_buyer_fee(
    v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_limited_ticket_id, 'quantity', 1)),
    'test', 200, 30, 'test'
  );
  assert v_result->>'status' = 'reserved';
  v_result := public.reserve_checkout_order_with_buyer_fee(
    v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_limited_ticket_id, 'quantity', 1)),
    'test', 200, 30, 'test'
  );
  assert v_result->>'status' = 'sold_out', 'Additive fee checkout must retain inventory locks/checks';

  set local role service_role;
  v_result := public.reserve_checkout_order(
    v_slug, 'Legacy buyer', 'legacy@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket_id, 'quantity', 1)),
    'test', 200, 30, 'test'
  );
  reset role;
  v_legacy_order_id := (v_result->>'order_id')::bigint;
  select * into v_row from public.orders where id = v_legacy_order_id;
  assert v_row.amount_total = 10 and v_row.platform_fee_amount = 0.50
    and v_row.buyer_fee_amount = 0, 'Old deployments must preserve their original checkout contract';

  update public.orders set payment_status = 'paid' where id in (v_order_id, v_legacy_order_id);
  insert into public.passes (
    order_id, tournament_id, ticket_type_id, order_item_id,
    sequence_number, valid_from, valid_until
  ) select order_id, tournament_id, ticket_type_id, id, 1, valid_from, valid_until
    from public.order_items where order_id in (v_order_id, v_legacy_order_id);

  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_tournament_id, 'test');
  assert (v_metrics#>>'{sales,grossCapturedOnlineSales}')::numeric = 20;
  assert (v_metrics#>>'{sales,totalEstimatedRevenue}')::numeric = 20;
  assert (v_metrics#>>'{sales,estimatedStripeFees}')::numeric = 1.19,
    'Stripe processing estimate must include the buyer fee in its base';
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 18.31,
    'Director proceeds must not deduct the buyer-paid fee twice';
  assert (v_metrics#>>'{salesByDay,0,onlineRevenue}')::numeric = 20;
  assert (v_metrics#>>'{salesByTicketType,0,onlineRevenue}')::numeric = 20;
  assert public.get_director_lifetime_revenue('test') = 20;
  assert public.get_director_lifetime_revenue('live') = 0;
  assert public.get_tournament_dashboard_metrics(v_tournament_id, 'live') is null;
  reset role;

  -- The exact allocated fee can differ from a proportion of the refund. The
  -- database must use the persisted allocation, not recompute it for reports.
  update public.orders
  set payment_status = 'partial_refund', amount_refunded = 5.26,
      buyer_fee_refunded = 0.26, platform_fee_refunded = 0.26
  where id = v_order_id;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_tournament_id, 'test');
  assert (v_metrics#>>'{sales,onlineRefunds}')::numeric = 5;
  assert (v_metrics#>>'{sales,totalEstimatedRevenue}')::numeric = 15;
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 13.31;
  assert public.get_director_lifetime_revenue('test') = 15;
  reset role;

  v_denied := false;
  begin
    update public.orders set buyer_fee_amount = 0.40 where id = v_order_id;
  exception when others then v_denied := true;
  end;
  assert v_denied, 'Buyer fee snapshots must be immutable after reservation';
  v_denied := false;
  begin
    update public.orders set amount_total = 11 where id = v_order_id;
  exception when others then v_denied := true;
  end;
  assert v_denied, 'The charge snapshot of a buyer-fee order must be immutable';
  v_denied := false;
  begin
    update public.orders set buyer_fee_refunded = 0.25 where id = v_order_id;
  exception when others then v_denied := true;
  end;
  assert v_denied, 'Buyer fee refunds cannot decrease';
  v_denied := false;
  begin
    update public.orders set amount_refunded = 10.50 where id = v_order_id;
  exception when check_violation then v_denied := true;
  end;
  assert v_denied, 'A full charge refund must include the full buyer fee atomically';

  update public.orders
  set payment_status = 'refunded', amount_refunded = 10.50,
      buyer_fee_refunded = 0.50, platform_fee_refunded = 0.50
  where id = v_order_id;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_tournament_id, 'test');
  assert (v_metrics#>>'{sales,grossCapturedOnlineSales}')::numeric = 20;
  assert (v_metrics#>>'{sales,onlineRefunds}')::numeric = 10;
  assert (v_metrics#>>'{sales,totalEstimatedRevenue}')::numeric = 10;
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 8.31;
  assert public.get_director_lifetime_revenue('test') = 10;
  reset role;
end;
$$;

rollback;
