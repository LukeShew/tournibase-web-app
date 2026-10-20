-- Disposable database regression. All fixture records roll back; no Stripe calls.
begin;
do $$
declare
  v_user uuid := gen_random_uuid();
  v_org bigint;
  v_event bigint;
  v_ticket bigint;
  v_child bigint;
  v_free bigint;
  v_limited bigint;
  v_order bigint;
  v_legacy bigint;
  v_director_fee_order bigint;
  v_free_order bigint;
  v_slug text := 'tiered-fee-' || replace(gen_random_uuid()::text, '-', '');
  v_account text := 'acct_tiered_' || replace(gen_random_uuid()::text, '-', '');
  v_result jsonb;
  v_metrics jsonb;
  v_prices integer[] := array[0, 1, 500, 1000, 1001, 1012, 1013, 1500, 2000, 2500];
  v_fees integer[] := array[0, 100, 100, 100, 140, 140, 141, 160, 180, 200];
  v_i integer;
  v_count bigint;
  v_denied boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user, v_user::text || '@example.invalid', '{"name":"Tiered fee regression"}');
  insert into public.organizations (name, owner_user_id, operating_environment)
  values ('Tiered fee regression', v_user, 'test') returning id into v_org;
  insert into public.organization_stripe_accounts (
    organization_id, stripe_account_id, stripe_environment, onboarding_complete,
    charges_enabled, payouts_enabled, card_payments_status, payouts_status, fees_collector
  ) values (v_org, v_account, 'test', true, true, true, 'active', 'active', 'application');
  insert into public.tournaments (
    organization_id, name, start_date, end_date, venue_name, organizer_name,
    contact_email, public_slug, status, time_zone
  ) values (v_org, 'Tiered fee regression', current_date, current_date + 2,
    'Venue', 'Director', 'director@example.invalid', v_slug, 'published', 'UTC')
  returning id into v_event;
  insert into public.ticket_types (tournament_id, name, price, valid_from, valid_until)
  values (v_event, 'Adult', 15, current_date, current_date + 2) returning id into v_ticket;
  insert into public.ticket_types (tournament_id, name, price, valid_from, valid_until)
  values (v_event, 'Child', 5, current_date, current_date + 2) returning id into v_child;
  insert into public.ticket_types (tournament_id, name, price, valid_from, valid_until)
  values (v_event, 'Free', 0, current_date, current_date + 2) returning id into v_free;
  insert into public.ticket_types (tournament_id, name, price, valid_from, valid_until, quantity_limit)
  values (v_event, 'Limited', 10, current_date, current_date + 2, 1) returning id into v_limited;
  perform set_config('request.jwt.claim.sub', v_user::text, true);

  assert has_function_privilege('service_role',
    'public.reserve_checkout_order_with_tiered_fee(text,text,text,text,text,jsonb,text,integer,integer,text,integer)', 'EXECUTE');
  assert not has_function_privilege('anon',
    'public.reserve_checkout_order_with_tiered_fee(text,text,text,text,text,jsonb,text,integer,integer,text,integer)', 'EXECUTE');
  assert not has_function_privilege('authenticated',
    'public.reserve_checkout_order_with_tiered_fee(text,text,text,text,text,jsonb,text,integer,integer,text,integer)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.get_tournament_dashboard_metrics(bigint)', 'EXECUTE');
  assert not has_table_privilege('authenticated', 'public.orders', 'UPDATE');
  assert not has_table_privilege('authenticated', 'public.order_items', 'UPDATE');

  for v_i in 1..array_length(v_prices, 1) loop
    update public.ticket_types set price = v_prices[v_i] / 100.0 where id = v_ticket;
    set local role service_role;
    v_result := public.reserve_checkout_order_with_tiered_fee(v_slug, 'Buyer', 'buyer@example.invalid', null, null,
      jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket, 'quantity', 3)), 'test', 400, 100, 'test');
    reset role;
    assert v_result->>'status' = 'reserved', 'Tiered reservation failed';
    assert (v_result->>'ticket_subtotal_cents')::bigint = v_prices[v_i] * 3;
    assert (v_result->>'buyer_fee_amount_cents')::bigint = v_fees[v_i] * 3, 'Per-ticket rounding or threshold is wrong';
    assert (v_result#>>'{items,0,buyer_fee_unit_amount_cents}')::bigint = v_fees[v_i];
    assert (v_result->>'amount_total_cents')::bigint = (v_prices[v_i] + v_fees[v_i]) * 3;
    assert v_result->>'fee_policy' = 'per_ticket_v2' and v_result->>'processing_fee_payer' = 'platform';
    assert (select bool_and(buyer_fee_unit_amount_cents = v_fees[v_i]) from public.order_items
      where order_id = (v_result->>'order_id')::bigint);
  end loop;

  update public.ticket_types set price = 15 where id = v_ticket;
  v_result := public.reserve_checkout_order_with_tiered_fee(v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket, 'quantity', 1),
      jsonb_build_object('ticket_type_id', v_child, 'quantity', 1),
      jsonb_build_object('ticket_type_id', v_free, 'quantity', 2)), 'test', 400, 100, 'test', 1000);
  v_order := (v_result->>'order_id')::bigint;
  assert (v_result->>'amount_total_cents')::bigint = 2260;
  assert (v_result->>'buyer_fee_amount_cents')::bigint = 260;
  assert jsonb_array_length(v_result->'items') = 3, 'Fee must not create a pass';
  assert (select buyer_fee_unit_amount_cents from public.order_items where order_id = v_order and ticket_type_id = v_child) = 100;
  assert (select buyer_fee_unit_amount_cents from public.order_items where order_id = v_order and ticket_type_id = v_free) = 0;

  v_denied := false;
  begin update public.order_items set buyer_fee_unit_amount_cents = 99 where order_id = v_order and ticket_type_id = v_child;
  exception when others then v_denied := true; end;
  assert v_denied, 'Saved per-ticket fees must be immutable even before capture';
  v_denied := false;
  begin update public.order_items set quantity = 2 where order_id = v_order and ticket_type_id = v_child;
  exception when others then v_denied := true; end;
  assert v_denied, 'Changing quantity must not invalidate fee allocation';
  v_denied := false;
  begin update public.orders set processing_fee_payer = 'director' where id = v_order;
  exception when others then v_denied := true; end;
  assert v_denied, 'Processor payer must be immutable';
  v_denied := false;
  begin update public.orders set fee_policy = 'legacy_order_v1' where id = v_order;
  exception when others then v_denied := true; end;
  assert v_denied, 'Pricing version must be immutable';

  select count(*) into v_count from public.orders where tournament_id = v_event;
  v_result := public.reserve_checkout_order_with_tiered_fee(v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket, 'quantity', 1)), 'test', 500, 100, 'test');
  assert v_result->>'status' = 'invalid_request', 'Unapproved percentage must fail';
  v_result := public.reserve_checkout_order_with_tiered_fee(v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket, 'quantity', 1)), 'test', 400, 100, 'test', 999);
  assert v_result->>'status' = 'invalid_request', 'Unapproved threshold must fail';
  v_result := public.reserve_checkout_order_with_tiered_fee(v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket, 'quantity', 1)), 'live', 400, 100, 'live');
  assert v_result->>'status' = 'event_unavailable', 'Cross-environment reservation must fail';
  update public.organization_stripe_accounts set fees_collector = null where organization_id = v_org;
  v_denied := false;
  begin
    perform public.reserve_checkout_order_with_tiered_fee(v_slug, 'Buyer', 'buyer@example.invalid', null, null,
      jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket, 'quantity', 1)), 'test', 400, 100, 'test');
  exception when others then v_denied := true; end;
  assert v_denied, 'Unknown processor payer cannot receive director-free paid orders';
  assert (select count(*) from public.orders where tournament_id = v_event) = v_count, 'Rejected reserve must roll back inventory/order';
  update public.organization_stripe_accounts set fees_collector = 'application' where organization_id = v_org;

  v_result := public.reserve_checkout_order_with_tiered_fee(v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_limited, 'quantity', 1)), 'test', 400, 100, 'test');
  assert v_result->>'status' = 'reserved';
  v_result := public.reserve_checkout_order_with_tiered_fee(v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_limited, 'quantity', 1)), 'test', 400, 100, 'test');
  assert v_result->>'status' = 'sold_out', 'Tiered pricing must retain inventory checks';

  -- Historical caller remains once-per-order; metrics combine both treatments.
  v_result := public.reserve_checkout_order_with_buyer_fee(v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket, 'quantity', 1)), 'test', 200, 30, 'test');
  v_legacy := (v_result->>'order_id')::bigint;
  assert (select fee_policy = 'legacy_order_v1' and processing_fee_payer = 'director' and buyer_fee_amount = 0.60
    from public.orders where id = v_legacy), 'Legacy reservations must not change';
  assert (select buyer_fee_unit_amount_cents is null from public.order_items where order_id = v_legacy);
  update public.orders set payment_status = 'paid' where id in (v_order, v_legacy);
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,grossCapturedOnlineSales}')::numeric = 35;
  assert (v_metrics#>>'{sales,estimatedStripeFees}')::numeric = 0.75;
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 34.25,
    'Only legacy director-paid orders should lose estimated card processing';
  assert public.get_tournament_dashboard_metrics(v_event, 'live') is null;
  reset role;

  -- The platform fee can fund an insufficient-funds refund before buyer success.
  -- That advance remains buyer money, not extra director ticket proceeds.
  update public.orders set refund_pending_amount = 6, platform_fee_refunded = 1
  where id = v_order;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,onlineRefunds}')::numeric = 0;
  assert (v_metrics#>>'{sales,refundedTournibasePlatformFees}')::numeric = 1;
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 34.25,
    'A pending per-ticket fee advance must not inflate director ticket proceeds';
  assert (v_metrics#>>'{sales,estimatedNetPayout}')::numeric = 34.25;
  reset role;
  update public.orders set refund_pending_amount = 0, refund_failed_amount = 6
  where id = v_order;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,onlineRefunds}')::numeric = 0;
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 34.25,
    'A failed buyer refund must not turn its irreversible fee advance into director revenue';
  reset role;

  update public.orders set payment_status = 'partial_refund', amount_refunded = 6,
    buyer_fee_refunded = 1, platform_fee_refunded = 1 where id = v_order;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,onlineRefunds}')::numeric = 5;
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 29.25;
  reset role;
  update public.orders set refund_pending_amount = 16.60, platform_fee_refunded = 2.60
  where id = v_order;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,onlineRefunds}')::numeric = 5;
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 29.25,
    'Funding the remaining buyer fee must not undo the completed principal refund';
  reset role;
  update public.orders set payment_status = 'refunded', amount_refunded = 22.60,
    buyer_fee_refunded = 2.60, platform_fee_refunded = 2.60,
    refund_pending_amount = 0 where id = v_order;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 14.25,
    'Full refund must return the base without making the director absorb processing';
  reset role;

  -- Authoritative later failure restores only principal revenue, not the returned fee.
  update public.orders set payment_status = 'paid', amount_refunded = 0,
    buyer_fee_refunded = 0, refund_failed_amount = 22.60,
    refund_sync_version = refund_sync_version + 1 where id = v_order;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,onlineRefunds}')::numeric = 0;
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 34.25,
    'Later failed-refund correction restores base revenue without recognizing the fee advance';
  reset role;

  -- Legacy buyer-funded orders also must not count advanced fees as ticket proceeds;
  -- their original director-paid processing estimate must still be deducted.
  update public.orders set refund_pending_amount = 15.60, platform_fee_refunded = 0.60
  where id = v_legacy;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 34.25;
  assert (v_metrics#>>'{sales,estimatedStripeFees}')::numeric = 0.75;
  reset role;
  update public.orders set payment_status = 'refunded', amount_refunded = 15.60,
    buyer_fee_refunded = 0.60, refund_pending_amount = 0 where id = v_legacy;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,onlineRefunds}')::numeric = 15;
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 19.25,
    'Legacy buyer-funded full refund retains its original non-returned processing estimate';
  reset role;
  update public.orders set payment_status = 'paid', amount_refunded = 0,
    buyer_fee_refunded = 0, refund_failed_amount = 15.60,
    refund_sync_version = refund_sync_version + 1 where id = v_legacy;

  -- Pre-buyer-fee orders paid the platform fee out of ticket value. Keep that
  -- historical subtraction even alongside new tiers, fee advances, and free orders.
  v_result := public.reserve_checkout_order(v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_ticket, 'quantity', 1)), 'test', 200, 30, 'test');
  v_director_fee_order := (v_result->>'order_id')::bigint;
  assert (select buyer_fee_amount = 0 and platform_fee_amount = 0.60
    and processing_fee_payer = 'director' from public.orders where id = v_director_fee_order);
  v_result := public.reserve_checkout_order_with_tiered_fee(v_slug, 'Buyer', 'buyer@example.invalid', null, null,
    jsonb_build_array(jsonb_build_object('ticket_type_id', v_free, 'quantity', 1)), 'test', 400, 100, 'test');
  v_free_order := (v_result->>'order_id')::bigint;
  update public.orders set payment_status = 'paid' where id in (v_director_fee_order, v_free_order);
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,grossCapturedOnlineSales}')::numeric = 50;
  assert (v_metrics#>>'{sales,onlineOrderCount}')::integer = 3,
    'A free per-ticket-policy order must not create a processing charge estimate';
  assert (v_metrics#>>'{sales,estimatedStripeFees}')::numeric = 1.49;
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 47.91,
    'Mixed-era reporting must deduct the historical director-funded application fee only';
  reset role;
  update public.orders set platform_fee_refunded = 0.60 where id = v_director_fee_order;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 48.51,
    'Returning a historical director-funded fee retains its original reporting behavior';
  reset role;
  update public.orders set amount_refunded = 5, payment_status = 'partial_refund'
  where id = v_director_fee_order;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 43.51;
  reset role;
  update public.orders set amount_refunded = 15, payment_status = 'refunded'
  where id = v_director_fee_order;
  set local role authenticated;
  v_metrics := public.get_tournament_dashboard_metrics(v_event, 'test');
  assert (v_metrics#>>'{sales,estimatedDirectorProceeds}')::numeric = 33.51,
    'Legacy full refunds retain processing costs without subtracting already returned platform fees';
  assert (v_metrics#>>'{sales,estimatedNetPayout}')::numeric = 33.51;
  reset role;
end;
$$;
rollback;
