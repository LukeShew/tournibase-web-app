-- Applied hosted migration version: 20261017234245.
-- Additive rollout: existing orders and the old reservation RPC keep their
-- original director-paid fee behavior. Only the new RPC adds a buyer fee.
begin;

alter table public.orders
  add column buyer_fee_amount numeric(10, 2) not null default 0,
  add column buyer_fee_refunded numeric(10, 2) not null default 0,
  add constraint orders_buyer_fee_valid check (
    buyer_fee_amount >= 0
    and buyer_fee_amount <= platform_fee_amount
    and buyer_fee_amount <= amount_total
  ),
  add constraint orders_buyer_fee_refunded_valid check (
    buyer_fee_refunded >= 0
    and buyer_fee_refunded <= buyer_fee_amount
    and buyer_fee_refunded <= amount_refunded
    and amount_refunded - buyer_fee_refunded <= amount_total - buyer_fee_amount
  );

comment on column public.orders.buyer_fee_amount is
  'Immutable TourniBase fee added above ticket prices, in dollars. Included in amount_total and platform_fee_amount. Zero for historical director-paid-fee orders.';
comment on column public.orders.buyer_fee_refunded is
  'Cumulative refunded buyer-paid fee, in dollars, included in amount_refunded. Uses successful refund allocation metadata; external refunds use proportional allocation.';

create or replace function private.enforce_order_stripe_snapshot_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_initial_buyer_fee_addition boolean;
begin
  -- reserve_checkout_order_with_buyer_fee first calls the existing atomic
  -- inventory reservation with a zero application fee, then fills the fee
  -- snapshot before this transaction commits. No existing order is repriced.
  v_initial_buyer_fee_addition :=
    old.created_at = transaction_timestamp()
    and old.payment_status = 'pending'
    and new.payment_status = 'pending'
    and old.stripe_checkout_id is null
    and old.stripe_payment_intent_id is null
    and old.stripe_charge_id is null
    and new.stripe_checkout_id is null
    and new.stripe_payment_intent_id is null
    and new.stripe_charge_id is null
    and old.amount_refunded = 0
    and new.amount_refunded = 0
    and old.platform_fee_amount = 0
    and old.buyer_fee_amount = 0
    and new.buyer_fee_amount > 0
    and new.platform_fee_amount = new.buyer_fee_amount
    and new.amount_total = old.amount_total + new.buyer_fee_amount
    and old.amount_total > 0;

  if new.stripe_connected_account_id is distinct from old.stripe_connected_account_id
    or new.stripe_environment is distinct from old.stripe_environment
    or (
      (new.platform_fee_amount is distinct from old.platform_fee_amount
        or new.buyer_fee_amount is distinct from old.buyer_fee_amount)
      and not v_initial_buyer_fee_addition
    )
    or (
      old.buyer_fee_amount > 0
      and new.amount_total is distinct from old.amount_total
    )
  then
    raise exception 'Stripe routing and fee snapshots are immutable.';
  end if;

  if old.stripe_payment_intent_id is not null
    and new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
  then
    raise exception 'The Stripe PaymentIntent snapshot cannot be changed once recorded.';
  end if;

  if old.stripe_charge_id is not null
    and new.stripe_charge_id is distinct from old.stripe_charge_id
  then
    raise exception 'The Stripe charge snapshot cannot be changed once recorded.';
  end if;

  if new.platform_fee_refunded < old.platform_fee_refunded then
    raise exception 'The refunded TourniBase fee cannot decrease.';
  end if;
  if new.buyer_fee_refunded < old.buyer_fee_refunded then
    raise exception 'The refunded buyer fee cannot decrease.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_order_stripe_snapshot_immutability()
  from public, anon, authenticated;

create function public.reserve_checkout_order_with_buyer_fee(
  p_event_slug text,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_buyer_team_name text,
  p_items jsonb,
  p_stripe_environment text,
  p_platform_fee_bps integer,
  p_platform_fee_fixed_cents integer,
  p_app_environment text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reservation jsonb;
  v_subtotal_cents bigint;
  v_buyer_fee_cents bigint := 0;
  v_total_cents bigint;
  v_order_id bigint;
begin
  if p_app_environment is null
    or p_app_environment not in ('test', 'live')
    or p_stripe_environment is distinct from p_app_environment
    or p_platform_fee_bps is null
    or p_platform_fee_bps < 0
    or p_platform_fee_bps > 10000
    or p_platform_fee_fixed_cents is null
    or p_platform_fee_fixed_cents < 0
    or p_platform_fee_fixed_cents > 100000000
  then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Check the payment environment and fee configuration.'
    );
  end if;

  -- Reuse its environment boundary, inventory locks, ticket price snapshots,
  -- capacity checks, expiry checks, and connected-account readiness checks.
  v_reservation := public.reserve_checkout_order(
    p_event_slug, p_buyer_name, p_buyer_email, p_buyer_phone,
    p_buyer_team_name, p_items, p_stripe_environment, 0, 0,
    p_app_environment
  );

  if v_reservation->>'status' is distinct from 'reserved' then
    return v_reservation;
  end if;

  v_order_id := (v_reservation->>'order_id')::bigint;
  v_subtotal_cents := (v_reservation->>'amount_total_cents')::bigint;

  if v_subtotal_cents > 0 then
    v_buyer_fee_cents := round(
      v_subtotal_cents::numeric * p_platform_fee_bps::numeric / 10000
    )::bigint + p_platform_fee_fixed_cents;
  end if;
  v_total_cents := v_subtotal_cents + v_buyer_fee_cents;

  if v_total_cents > 9999999999 then
    -- Raising rolls the reservation back as well; never leave stale inventory
    -- behind when the numeric(10,2) charge total cannot be represented.
    raise exception 'The order total exceeds the supported amount.';
  end if;

  update public.orders
  set amount_total = (v_total_cents / 100.0)::numeric(10, 2),
      platform_fee_amount = (v_buyer_fee_cents / 100.0)::numeric(10, 2),
      buyer_fee_amount = (v_buyer_fee_cents / 100.0)::numeric(10, 2)
  where id = v_order_id;

  return v_reservation || jsonb_build_object(
    'ticket_subtotal_cents', v_subtotal_cents,
    'buyer_fee_amount_cents', v_buyer_fee_cents,
    'platform_fee_amount_cents', v_buyer_fee_cents,
    'amount_total_cents', v_total_cents
  );
end;
$$;

revoke all on function public.reserve_checkout_order_with_buyer_fee(
  text, text, text, text, text, jsonb, text, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.reserve_checkout_order_with_buyer_fee(
  text, text, text, text, text, jsonb, text, integer, integer, text
) to service_role;

-- Keep dashboard ticket revenue separate from buyer-paid fees. Stripe fees
-- and net director proceeds still use the full charge amount, as Stripe does.
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
        connect_financial_totals.captured_charge_amount * 0.029
          + connect_financial_totals.stripe_order_count * 0.30,
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
              connect_financial_totals.captured_charge_amount * 0.029
                + connect_financial_totals.stripe_order_count * 0.30,
              2
            )
          - connect_financial_totals.retained_platform_fees,
      'estimatedNetPayout',
        connect_financial_totals.net_charge_amount
          - round(
              connect_financial_totals.captured_charge_amount * 0.029
                + connect_financial_totals.stripe_order_count * 0.30,
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


-- CREATE OR REPLACE preserves the hardened function permissions from the
-- environment-isolation rollout; do not regrant the legacy signatures.
create or replace function public.get_director_lifetime_revenue()
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select round(
    coalesce(
      (
        select sum(
          greatest(
            (customer_order.amount_total - customer_order.buyer_fee_amount)
              - (customer_order.amount_refunded - customer_order.buyer_fee_refunded),
            0::numeric
          )
        )
        from public.orders as customer_order
        join public.tournaments as tournament
          on tournament.id = customer_order.tournament_id
        join public.organizations as organization
          on organization.id = tournament.organization_id
        where organization.owner_user_id = (select auth.uid())
          and customer_order.payment_status in (
            'paid',
            'partial_refund',
            'refunded'
          )
      ),
      0::numeric
    )
    + coalesce(
      (
        select sum(manual_sale.amount)
        from public.manual_sales as manual_sale
        join public.tournaments as tournament
          on tournament.id = manual_sale.tournament_id
        join public.organizations as organization
          on organization.id = tournament.organization_id
        where organization.owner_user_id = (select auth.uid())
      ),
      0::numeric
    ),
    2
  );
$$;

create or replace function public.get_director_lifetime_revenue(
  p_app_environment text
)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_app_environment not in ('test', 'live') then 0::numeric
    else round(
      coalesce(
        (
          select sum(
            greatest(
              (customer_order.amount_total - customer_order.buyer_fee_amount)
                - (customer_order.amount_refunded - customer_order.buyer_fee_refunded),
              0::numeric
            )
          )
          from public.orders as customer_order
          join public.tournaments as tournament
            on tournament.id = customer_order.tournament_id
          join public.organizations as organization
            on organization.id = tournament.organization_id
          where organization.owner_user_id = (select auth.uid())
            and organization.operating_environment = p_app_environment
            and customer_order.stripe_environment = p_app_environment
            and customer_order.payment_status in (
              'paid',
              'partial_refund',
              'refunded'
            )
        ),
        0::numeric
      )
      + coalesce(
        (
          select sum(manual_sale.amount)
          from public.manual_sales as manual_sale
          join public.tournaments as tournament
            on tournament.id = manual_sale.tournament_id
          join public.organizations as organization
            on organization.id = tournament.organization_id
          where organization.owner_user_id = (select auth.uid())
            and organization.operating_environment = p_app_environment
        ),
        0::numeric
      ),
      2
    )
  end;
$$;

comment on function public.get_director_lifetime_revenue(text) is
  'Returns ticket revenue after ticket refunds, plus manual admissions, within the signed-in director''s environment. Excludes buyer-paid fees and their refunds.';

commit;
