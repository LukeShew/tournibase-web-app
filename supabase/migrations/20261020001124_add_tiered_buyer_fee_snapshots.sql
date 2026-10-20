-- Additive rollout: previous orders and reservation RPCs retain their original
-- fee/processor treatment. Only the new RPC creates director-free tiered orders.
begin;

alter table public.order_items
  add column buyer_fee_unit_amount_cents bigint,
  add constraint order_items_buyer_fee_unit_valid check (
    buyer_fee_unit_amount_cents is null or (
      buyer_fee_unit_amount_cents >= 0
      and (unit_amount_cents > 0 or buyer_fee_unit_amount_cents = 0)
    )
  );

alter table public.orders
  add column fee_policy text not null default 'legacy_order_v1'
    check (fee_policy in ('legacy_order_v1', 'per_ticket_v2')),
  add column processing_fee_payer text not null default 'director'
    check (processing_fee_payer in ('director', 'platform'));

alter table public.organization_stripe_accounts
  add column fees_collector text
    check (fees_collector in ('application', 'stripe', 'application_custom', 'application_express'));

comment on column public.order_items.buyer_fee_unit_amount_cents is
  'Immutable buyer service fee for one pass when reserved. NULL preserves historical order-proportional allocation; zero is an explicit free-pass snapshot.';
comment on column public.orders.fee_policy is
  'Immutable reservation pricing version. Historical orders remain legacy_order_v1 and are never repriced.';
comment on column public.orders.processing_fee_payer is
  'Immutable processor-cost responsibility at checkout. platform orders preserve director ticket proceeds; historical director orders retain their original fee estimates.';
comment on column public.organization_stripe_accounts.fees_collector is
  'Most recently verified Stripe defaults.responsibilities.fees_collector. NULL means not verified, never inferred from account readiness.';

create or replace function private.enforce_order_stripe_snapshot_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_initial_buyer_fee_addition boolean;
  v_initial_tiered_snapshot boolean;
  v_initial_reservation boolean;
begin
  v_initial_reservation :=
    old.created_at = transaction_timestamp()
    and old.payment_status = 'pending' and new.payment_status = 'pending'
    and old.stripe_checkout_id is null and new.stripe_checkout_id is null
    and old.stripe_payment_intent_id is null and new.stripe_payment_intent_id is null
    and old.stripe_charge_id is null and new.stripe_charge_id is null
    and old.amount_refunded = 0 and new.amount_refunded = 0
    and old.platform_fee_amount = 0 and old.buyer_fee_amount = 0;

  -- Preserve the old deployment's once-per-order reservation contract.
  v_initial_buyer_fee_addition := v_initial_reservation
    and old.fee_policy = 'legacy_order_v1' and new.fee_policy = 'legacy_order_v1'
    and old.processing_fee_payer = 'director' and new.processing_fee_payer = 'director'
    and new.buyer_fee_amount > 0
    and new.platform_fee_amount = new.buyer_fee_amount
    and new.amount_total = old.amount_total + new.buyer_fee_amount
    and old.amount_total > 0;

  v_initial_tiered_snapshot := v_initial_reservation
    and old.fee_policy = 'legacy_order_v1' and new.fee_policy = 'per_ticket_v2'
    and old.processing_fee_payer = 'director' and new.processing_fee_payer = 'platform'
    and new.platform_fee_amount = new.buyer_fee_amount
    and new.amount_total = old.amount_total + new.buyer_fee_amount
    and exists (select 1 from public.order_items where order_id = old.id)
    and not exists (
      select 1 from public.order_items
      where order_id = old.id and buyer_fee_unit_amount_cents is null
    )
    and new.buyer_fee_amount = (
      select coalesce(sum(buyer_fee_unit_amount_cents * quantity), 0) / 100.0
      from public.order_items where order_id = old.id
    );

  if new.stripe_connected_account_id is distinct from old.stripe_connected_account_id
    or new.stripe_environment is distinct from old.stripe_environment
    or ((new.platform_fee_amount is distinct from old.platform_fee_amount
        or new.buyer_fee_amount is distinct from old.buyer_fee_amount)
      and not (v_initial_buyer_fee_addition or v_initial_tiered_snapshot))
    or ((new.fee_policy is distinct from old.fee_policy
        or new.processing_fee_payer is distinct from old.processing_fee_payer)
      and not v_initial_tiered_snapshot)
    or ((old.buyer_fee_amount > 0 or old.fee_policy = 'per_ticket_v2')
      and new.amount_total is distinct from old.amount_total)
  then
    raise exception 'Stripe routing and fee snapshots are immutable.';
  end if;

  if old.stripe_payment_intent_id is not null
    and new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id then
    raise exception 'The Stripe PaymentIntent snapshot cannot be changed once recorded.';
  end if;
  if old.stripe_charge_id is not null
    and new.stripe_charge_id is distinct from old.stripe_charge_id then
    raise exception 'The Stripe charge snapshot cannot be changed once recorded.';
  end if;
  if new.platform_fee_refunded < old.platform_fee_refunded then
    raise exception 'The refunded TourniBase fee cannot decrease.';
  end if;
  if (new.buyer_fee_refunded < old.buyer_fee_refunded
      or new.amount_refunded < old.amount_refunded)
    and new.refund_sync_version <> old.refund_sync_version + 1 then
    raise exception 'Refund corrections require a fresh synchronization version.';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_order_stripe_snapshot_immutability()
  from public, anon, authenticated;

create function private.enforce_order_item_buyer_fee_snapshot_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.buyer_fee_unit_amount_cents is not null then
    if new.buyer_fee_unit_amount_cents is distinct from old.buyer_fee_unit_amount_cents
      or new.unit_amount_cents is distinct from old.unit_amount_cents
      or new.quantity is distinct from old.quantity
      or new.order_id is distinct from old.order_id
      or new.ticket_type_id is distinct from old.ticket_type_id
      or new.tournament_id is distinct from old.tournament_id then
      raise exception 'Original per-ticket prices and buyer fees are immutable.';
    end if;
  elsif new.buyer_fee_unit_amount_cents is not null and not (
    old.created_at = transaction_timestamp()
    and new.order_id = old.order_id
    and new.unit_amount_cents = old.unit_amount_cents
    and new.quantity = old.quantity
    and new.ticket_type_id = old.ticket_type_id
    and new.tournament_id = old.tournament_id
    and exists (
      select 1 from public.orders
      where id = old.order_id and created_at = transaction_timestamp()
        and payment_status = 'pending' and fee_policy = 'legacy_order_v1'
        and stripe_checkout_id is null and stripe_payment_intent_id is null
        and stripe_charge_id is null and amount_refunded = 0
        and platform_fee_amount = 0 and buyer_fee_amount = 0
    )
  ) then
    raise exception 'An existing order cannot receive a new per-ticket buyer fee.';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_order_item_buyer_fee_snapshot_immutability()
  from public, anon, authenticated;
create trigger order_items_enforce_buyer_fee_snapshot_immutability
  before update on public.order_items
  for each row execute function private.enforce_order_item_buyer_fee_snapshot_immutability();

create function public.reserve_checkout_order_with_tiered_fee(
  p_event_slug text,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_buyer_team_name text,
  p_items jsonb,
  p_stripe_environment text,
  p_platform_fee_bps integer,
  p_platform_fee_fixed_cents integer,
  p_app_environment text,
  p_percentage_threshold_cents integer default 1000
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reservation jsonb;
  v_subtotal_cents bigint;
  v_buyer_fee_cents bigint;
  v_total_cents bigint;
  v_order_id bigint;
  v_items jsonb;
begin
  if p_app_environment is null or p_app_environment not in ('test', 'live')
    or p_stripe_environment is distinct from p_app_environment
    or p_platform_fee_bps is distinct from 400
    or p_platform_fee_fixed_cents is distinct from 100
    or p_percentage_threshold_cents is distinct from 1000 then
    return jsonb_build_object('status', 'invalid_request',
      'message', 'Check the payment environment and approved per-ticket fee configuration.');
  end if;

  v_reservation := public.reserve_checkout_order(
    p_event_slug, p_buyer_name, p_buyer_email, p_buyer_phone,
    p_buyer_team_name, p_items, p_stripe_environment, 0, 0, p_app_environment
  );
  if v_reservation->>'status' is distinct from 'reserved' then return v_reservation; end if;

  v_order_id := (v_reservation->>'order_id')::bigint;
  v_subtotal_cents := (v_reservation->>'amount_total_cents')::bigint;
  perform 1 from public.orders where id = v_order_id for update;

  if v_subtotal_cents > 0 and not exists (
    select 1 from public.organization_stripe_accounts
    where organization_id = (v_reservation->>'organization_id')::bigint
      and stripe_account_id = v_reservation->>'stripe_connected_account_id'
      and stripe_environment = p_stripe_environment
      and fees_collector = 'application'
  ) then
    -- An exception rolls back inventory and the new order in this transaction.
    raise exception 'Platform-paid Stripe processing must be verified before checkout.';
  end if;

  update public.order_items
  set buyer_fee_unit_amount_cents = case
    when unit_amount_cents = 0 then 0
    when unit_amount_cents <= p_percentage_threshold_cents then p_platform_fee_fixed_cents
    else p_platform_fee_fixed_cents
      + round(unit_amount_cents::numeric * p_platform_fee_bps::numeric / 10000)::bigint
    end
  where order_id = v_order_id;

  select coalesce(sum(buyer_fee_unit_amount_cents * quantity), 0)::bigint
  into v_buyer_fee_cents from public.order_items where order_id = v_order_id;
  v_total_cents := v_subtotal_cents + v_buyer_fee_cents;
  if v_total_cents > 9999999999 then raise exception 'The order total exceeds the supported amount.'; end if;

  update public.orders
  set amount_total = (v_total_cents / 100.0)::numeric(10, 2),
      platform_fee_amount = (v_buyer_fee_cents / 100.0)::numeric(10, 2),
      buyer_fee_amount = (v_buyer_fee_cents / 100.0)::numeric(10, 2),
      fee_policy = 'per_ticket_v2', processing_fee_payer = 'platform'
  where id = v_order_id;

  select jsonb_agg(item.value || jsonb_build_object(
    'buyer_fee_unit_amount_cents', original.buyer_fee_unit_amount_cents
  ) order by item.ordinality)
  into v_items
  from jsonb_array_elements(v_reservation->'items') with ordinality as item(value, ordinality)
  join public.order_items as original
    on original.order_id = v_order_id
    and original.ticket_type_id = (item.value->>'ticket_type_id')::bigint;

  return v_reservation || jsonb_build_object(
    'ticket_subtotal_cents', v_subtotal_cents,
    'buyer_fee_amount_cents', v_buyer_fee_cents,
    'platform_fee_amount_cents', v_buyer_fee_cents,
    'amount_total_cents', v_total_cents,
    'fee_policy', 'per_ticket_v2', 'processing_fee_payer', 'platform',
    'items', v_items
  );
end;
$$;

revoke all on function public.reserve_checkout_order_with_tiered_fee(
  text, text, text, text, text, jsonb, text, integer, integer, text, integer
) from public, anon, authenticated;
grant execute on function public.reserve_checkout_order_with_tiered_fee(
  text, text, text, text, text, jsonb, text, integer, integer, text, integer
) to service_role;

-- Dashboard metrics are replaced below while preserving their hardened grants.
create or replace function public.get_tournament_dashboard_metrics(
  p_tournament_id bigint
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with authorized_tournament as (
    select
      tournament.id,
      tournament.name,
      tournament.start_date,
      tournament.end_date,
      tournament.venue_name,
      tournament.status,
      tournament.public_slug,
      tournament.time_zone
    from public.tournaments as tournament
    join public.organizations as organization
      on organization.id = tournament.organization_id
    where tournament.id = p_tournament_id
      and organization.owner_user_id = (select auth.uid())
  ),
  captured_orders as (
    select
      customer_order.id,
      (customer_order.amount_total - customer_order.buyer_fee_amount)
        as amount_total,
      (customer_order.amount_refunded - customer_order.buyer_fee_refunded)
        as amount_refunded,
      greatest(
        (customer_order.amount_total - customer_order.buyer_fee_amount)
          - (customer_order.amount_refunded - customer_order.buyer_fee_refunded),
        0::numeric
      )::numeric(12, 2) as net_amount,
      customer_order.amount_total as charge_amount_total,
      greatest(customer_order.amount_total - customer_order.amount_refunded, 0::numeric)
        as charge_net_amount,
      customer_order.processing_fee_payer,
      customer_order.platform_fee_amount,
      customer_order.platform_fee_refunded,
      customer_order.payment_status,
      customer_order.created_at
    from public.orders as customer_order
    where customer_order.tournament_id = p_tournament_id
      and customer_order.payment_status in ('paid', 'partial_refund', 'refunded')
      and exists (select 1 from authorized_tournament)
  ),
  connect_financial_totals as (
    select
      count(*) filter (
        where captured_order.charge_amount_total > 0
      )::integer as stripe_order_count,
      count(*) filter (
        where captured_order.charge_amount_total > 0
          and captured_order.processing_fee_payer = 'director'
      )::integer as director_stripe_order_count,
      coalesce(sum(captured_order.charge_amount_total) filter (
        where captured_order.processing_fee_payer = 'director'
      ), 0::numeric) as director_charge_amount,
      coalesce(sum(captured_order.amount_total), 0::numeric)
        as captured_revenue,
      coalesce(sum(captured_order.amount_refunded), 0::numeric)
        as refunded_revenue,
      coalesce(sum(captured_order.net_amount), 0::numeric)
        as net_revenue,
      coalesce(sum(captured_order.charge_amount_total), 0::numeric)
        as captured_charge_amount,
      coalesce(sum(captured_order.charge_net_amount), 0::numeric)
        as net_charge_amount,
      coalesce(sum(
        greatest(
          captured_order.platform_fee_amount
            - captured_order.platform_fee_refunded,
          0::numeric
        )
      ), 0::numeric) as retained_platform_fees,
      coalesce(sum(captured_order.platform_fee_refunded), 0::numeric)
        as refunded_platform_fees
    from captured_orders as captured_order
  ),
  paid_orders as (
    select *
    from captured_orders
    where payment_status in ('paid', 'partial_refund')
  ),
  paid_order_totals as (
    select
      count(*)::integer as order_count,
      coalesce(sum(paid_order.amount_total), 0::numeric) as captured_revenue,
      coalesce(sum(paid_order.net_amount), 0::numeric) as net_revenue
    from paid_orders as paid_order
  ),
  eligible_passes as (
    select
      candidate_pass.id,
      candidate_pass.order_id,
      candidate_pass.ticket_type_id,
      candidate_pass.order_item_id
    from public.passes as candidate_pass
    join paid_orders as paid_order on paid_order.id = candidate_pass.order_id
    where candidate_pass.tournament_id = p_tournament_id
      and candidate_pass.status in ('active', 'checked_in')
  ),
  eligible_pass_totals as (
    select count(*)::integer as ticket_count from eligible_passes
  ),
  eligible_order_gross as (
    select
      eligible_pass.order_id,
      coalesce(
        sum(order_item.unit_amount_cents / 100.0),
        0::numeric
      )::numeric(12, 2) as remaining_pass_gross
    from eligible_passes as eligible_pass
    join public.order_items as order_item
      on order_item.id = eligible_pass.order_item_id
    group by eligible_pass.order_id
  ),
  paid_order_quantities as (
    select
      paid_order.id as order_id,
      paid_order.amount_total,
      paid_order.net_amount,
      paid_order.created_at,
      count(eligible_pass.id)::integer as ticket_count
    from paid_orders as paid_order
    left join eligible_passes as eligible_pass
      on eligible_pass.order_item_id in (
        select order_item.id
        from public.order_items as order_item
        where order_item.order_id = paid_order.id
      )
    group by
      paid_order.id,
      paid_order.amount_total,
      paid_order.net_amount,
      paid_order.created_at
  ),
  manual_totals as (
    select
      count(*)::integer as sale_count,
      coalesce(sum(manual_sale.quantity), 0)::integer as admission_count,
      coalesce(sum(manual_sale.amount), 0::numeric) as gross_revenue
    from public.manual_sales as manual_sale
    where manual_sale.tournament_id = p_tournament_id
      and exists (select 1 from authorized_tournament)
  ),
  gate_totals as (
    select
      count(*)::integer as total_attempts,
      count(*) filter (
        where check_in.result in ('valid', 'manual_check_in', 'override')
          and check_in.undone_at is null
          and candidate_pass.status in ('active', 'checked_in')
          and customer_order.payment_status in ('paid', 'partial_refund')
      )::integer as successful_check_ins,
      count(*) filter (where check_in.result = 'already_used')::integer
        as duplicate_attempts,
      count(*) filter (where check_in.result = 'invalid')::integer
        as invalid_attempts,
      count(*) filter (where check_in.result = 'wrong_day')::integer
        as wrong_day_attempts,
      count(*) filter (where check_in.result = 'manual_check_in')::integer
        as manual_check_ins,
      count(*) filter (where check_in.result = 'override')::integer
        as overrides,
      count(distinct check_in.pass_id) filter (
        where check_in.result in ('valid', 'manual_check_in', 'override')
          and check_in.undone_at is null
          and candidate_pass.status in ('active', 'checked_in')
          and customer_order.payment_status in ('paid', 'partial_refund')
      )::integer as checked_in_passes
    from public.check_ins as check_in
    left join public.passes as candidate_pass on candidate_pass.id = check_in.pass_id
    left join public.orders as customer_order on customer_order.id = candidate_pass.order_id
    where check_in.tournament_id = p_tournament_id
      and exists (select 1 from authorized_tournament)
  ),
  scanner_totals as (
    select
      count(*)::integer as total_links,
      count(*) filter (
        where scanner_session.revoked_at is null
          and scanner_session.expires_at > current_timestamp
      )::integer as active_links
    from public.scanner_sessions as scanner_session
    where scanner_session.tournament_id = p_tournament_id
      and exists (select 1 from authorized_tournament)
  ),
  online_by_ticket as (
    select
      order_item.ticket_type_id,
      count(eligible_pass.id)::integer as ticket_count,
      coalesce(sum(
        case
          when eligible_order.remaining_pass_gross > 0 then
            (order_item.unit_amount_cents / 100.0)
              * least(
                  1::numeric,
                  paid_order.net_amount
                    / eligible_order.remaining_pass_gross
                )
          else 0
        end
      ), 0::numeric)::numeric(12, 2) as net_revenue
    from eligible_passes as eligible_pass
    join public.order_items as order_item on order_item.id = eligible_pass.order_item_id
    join paid_orders as paid_order on paid_order.id = order_item.order_id
    join eligible_order_gross as eligible_order
      on eligible_order.order_id = paid_order.id
    group by order_item.ticket_type_id
  ),
  manual_by_ticket as (
    select
      manual_sale.ticket_type_id,
      sum(manual_sale.quantity)::integer as admission_count,
      sum(manual_sale.amount)::numeric(12, 2) as gross_revenue
    from public.manual_sales as manual_sale
    where manual_sale.tournament_id = p_tournament_id
      and exists (select 1 from authorized_tournament)
    group by manual_sale.ticket_type_id
  ),
  ticket_type_sales as (
    select
      ticket_type.id,
      ticket_type.name,
      coalesce(online_sale.ticket_count, 0)::integer as online_tickets,
      coalesce(online_sale.net_revenue, 0::numeric)::numeric(12, 2)
        as online_revenue,
      coalesce(manual_sale.admission_count, 0)::integer as manual_admissions,
      coalesce(manual_sale.gross_revenue, 0::numeric)::numeric(12, 2)
        as manual_revenue
    from public.ticket_types as ticket_type
    left join online_by_ticket as online_sale
      on online_sale.ticket_type_id = ticket_type.id
    left join manual_by_ticket as manual_sale
      on manual_sale.ticket_type_id = ticket_type.id
    where ticket_type.tournament_id = p_tournament_id
      and exists (select 1 from authorized_tournament)
  ),
  online_by_day as (
    select
      (paid_order.created_at at time zone authorized_tournament.time_zone)::date
        as sale_day,
      sum(paid_order.ticket_count)::integer as online_tickets,
      sum(paid_order.net_amount)::numeric(12, 2) as online_revenue
    from paid_order_quantities as paid_order
    cross join authorized_tournament
    group by sale_day
  ),
  manual_by_day as (
    select
      (manual_sale.created_at at time zone authorized_tournament.time_zone)::date
        as sale_day,
      sum(manual_sale.quantity)::integer as manual_admissions,
      sum(manual_sale.amount)::numeric(12, 2) as manual_revenue
    from public.manual_sales as manual_sale
    cross join authorized_tournament
    where manual_sale.tournament_id = p_tournament_id
    group by sale_day
  ),
  all_sale_days as (
    select sale_day from online_by_day
    union
    select sale_day from manual_by_day
  ),
  daily_sales as (
    select
      sale_day.sale_day,
      coalesce(online_sale.online_tickets, 0)::integer as online_tickets,
      coalesce(online_sale.online_revenue, 0::numeric)::numeric(12, 2)
        as online_revenue,
      coalesce(manual_sale.manual_admissions, 0)::integer as manual_admissions,
      coalesce(manual_sale.manual_revenue, 0::numeric)::numeric(12, 2)
        as manual_revenue
    from all_sale_days as sale_day
    left join online_by_day as online_sale on online_sale.sale_day = sale_day.sale_day
    left join manual_by_day as manual_sale on manual_sale.sale_day = sale_day.sale_day
  )
  select jsonb_build_object(
    'tournament', jsonb_build_object(
      'id', authorized_tournament.id,
      'name', authorized_tournament.name,
      'startDate', authorized_tournament.start_date,
      'endDate', authorized_tournament.end_date,
      'venueName', authorized_tournament.venue_name,
      'status', authorized_tournament.status,
      'publicSlug', authorized_tournament.public_slug,
      'timeZone', authorized_tournament.time_zone
    ),
    'scannerLinks', jsonb_build_object(
      'total', scanner_totals.total_links,
      'active', scanner_totals.active_links
    ),
    'sales', jsonb_build_object(
      'onlineOrderCount', connect_financial_totals.stripe_order_count,
      'onlineTicketsSold', eligible_pass_totals.ticket_count,
      'grossOnlineSales', round(paid_order_totals.net_revenue, 2),
      'grossCapturedOnlineSales', round(
        connect_financial_totals.captured_revenue,
        2
      ),
      'onlineRefunds', round(
        connect_financial_totals.refunded_revenue,
        2
      ),
      'estimatedStripeFees', round(
        connect_financial_totals.director_charge_amount * 0.029
          + connect_financial_totals.director_stripe_order_count * 0.30,
        2
      ),
      'tournibasePlatformFees', round(
        connect_financial_totals.retained_platform_fees,
        2
      ),
      'refundedTournibasePlatformFees', round(
        connect_financial_totals.refunded_platform_fees,
        2
      ),
      'estimatedDirectorProceeds',
        connect_financial_totals.net_charge_amount
          - round(
              connect_financial_totals.director_charge_amount * 0.029
                + connect_financial_totals.director_stripe_order_count * 0.30,
              2
            )
          - connect_financial_totals.retained_platform_fees,
      'estimatedNetPayout',
        connect_financial_totals.net_charge_amount
          - round(
              connect_financial_totals.director_charge_amount * 0.029
                + connect_financial_totals.director_stripe_order_count * 0.30,
              2
            )
          - connect_financial_totals.retained_platform_fees,
      'manualSaleCount', manual_totals.sale_count,
      'manualAdmissions', manual_totals.admission_count,
      'manualSales', round(manual_totals.gross_revenue, 2),
      'totalEstimatedRevenue', round(
        paid_order_totals.net_revenue + manual_totals.gross_revenue,
        2
      )
    ),
    'gate', jsonb_build_object(
      'totalScanAttempts', gate_totals.total_attempts,
      'successfulCheckIns', gate_totals.successful_check_ins,
      'duplicateAttempts', gate_totals.duplicate_attempts,
      'invalidAttempts', gate_totals.invalid_attempts,
      'wrongDayAttempts', gate_totals.wrong_day_attempts,
      'manualCheckIns', gate_totals.manual_check_ins,
      'overrides', gate_totals.overrides,
      'checkedInPasses', gate_totals.checked_in_passes,
      'unscannedPasses', greatest(
        eligible_pass_totals.ticket_count - gate_totals.checked_in_passes,
        0
      )
    ),
    'salesByTicketType', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ticketTypeId', ticket_sale.id,
        'ticketName', ticket_sale.name,
        'onlineTickets', ticket_sale.online_tickets,
        'onlineRevenue', ticket_sale.online_revenue,
        'manualAdmissions', ticket_sale.manual_admissions,
        'manualRevenue', ticket_sale.manual_revenue,
        'totalAdmissions', ticket_sale.online_tickets + ticket_sale.manual_admissions,
        'totalRevenue', ticket_sale.online_revenue + ticket_sale.manual_revenue
      ) order by ticket_sale.online_revenue + ticket_sale.manual_revenue desc,
        ticket_sale.name)
      from ticket_type_sales as ticket_sale
    ), '[]'::jsonb),
    'salesByDay', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', daily_sale.sale_day,
        'onlineTickets', daily_sale.online_tickets,
        'onlineRevenue', daily_sale.online_revenue,
        'manualAdmissions', daily_sale.manual_admissions,
        'manualRevenue', daily_sale.manual_revenue,
        'totalAdmissions', daily_sale.online_tickets + daily_sale.manual_admissions,
        'totalRevenue', daily_sale.online_revenue + daily_sale.manual_revenue
      ) order by daily_sale.sale_day desc)
      from daily_sales as daily_sale
    ), '[]'::jsonb)
  )
  from authorized_tournament
  cross join connect_financial_totals
  cross join paid_order_totals
  cross join eligible_pass_totals
  cross join manual_totals
  cross join gate_totals
  cross join scanner_totals;
$$;


-- No new client grants: the environment-scoped wrappers retain their permissions.
commit;
