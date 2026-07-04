-- Phase 13: aggregate director-facing sales and gate metrics in Postgres.
-- The function runs as the signed-in director, so existing RLS remains active.

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
  paid_orders as (
    select
      customer_order.id,
      customer_order.amount_total,
      customer_order.created_at
    from public.orders as customer_order
    where customer_order.tournament_id = p_tournament_id
      and customer_order.payment_status in ('paid', 'partial_refund')
      and exists (select 1 from authorized_tournament)
  ),
  paid_order_totals as (
    select
      count(*)::integer as order_count,
      coalesce(sum(paid_order.amount_total), 0::numeric) as gross_revenue
    from paid_orders as paid_order
  ),
  paid_order_item_totals as (
    select
      coalesce(sum(order_item.quantity), 0)::integer as ticket_count
    from public.order_items as order_item
    join paid_orders as paid_order
      on paid_order.id = order_item.order_id
  ),
  paid_order_quantities as (
    select
      paid_order.id as order_id,
      paid_order.amount_total,
      paid_order.created_at,
      coalesce(sum(order_item.quantity), 0)::integer as ticket_count
    from paid_orders as paid_order
    left join public.order_items as order_item
      on order_item.order_id = paid_order.id
    group by
      paid_order.id,
      paid_order.amount_total,
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
      )::integer as successful_check_ins,
      count(*) filter (
        where check_in.result = 'already_used'
      )::integer as duplicate_attempts,
      count(*) filter (
        where check_in.result = 'invalid'
      )::integer as invalid_attempts,
      count(*) filter (
        where check_in.result = 'wrong_day'
      )::integer as wrong_day_attempts,
      count(*) filter (
        where check_in.result = 'manual_check_in'
      )::integer as manual_check_ins,
      count(*) filter (
        where check_in.result = 'override'
      )::integer as overrides,
      count(distinct check_in.pass_id) filter (
        where check_in.result in ('valid', 'manual_check_in', 'override')
          and check_in.undone_at is null
      )::integer as checked_in_passes
    from public.check_ins as check_in
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
      sum(order_item.quantity)::integer as ticket_count,
      (
        sum(order_item.unit_amount_cents::bigint * order_item.quantity)
        / 100.0
      )::numeric(12, 2) as gross_revenue
    from public.order_items as order_item
    join paid_orders as paid_order
      on paid_order.id = order_item.order_id
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
      coalesce(online_sale.gross_revenue, 0::numeric)::numeric(12, 2)
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
      (
        paid_order.created_at at time zone authorized_tournament.time_zone
      )::date as sale_day,
      sum(paid_order.ticket_count)::integer as online_tickets,
      sum(paid_order.amount_total)::numeric(12, 2) as online_revenue
    from paid_order_quantities as paid_order
    cross join authorized_tournament
    group by sale_day
  ),
  manual_by_day as (
    select
      (
        manual_sale.created_at at time zone authorized_tournament.time_zone
      )::date as sale_day,
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
      coalesce(manual_sale.manual_admissions, 0)::integer
        as manual_admissions,
      coalesce(manual_sale.manual_revenue, 0::numeric)::numeric(12, 2)
        as manual_revenue
    from all_sale_days as sale_day
    left join online_by_day as online_sale
      on online_sale.sale_day = sale_day.sale_day
    left join manual_by_day as manual_sale
      on manual_sale.sale_day = sale_day.sale_day
  )
  select jsonb_build_object(
    'tournament',
    jsonb_build_object(
      'id', authorized_tournament.id,
      'name', authorized_tournament.name,
      'startDate', authorized_tournament.start_date,
      'endDate', authorized_tournament.end_date,
      'venueName', authorized_tournament.venue_name,
      'status', authorized_tournament.status,
      'publicSlug', authorized_tournament.public_slug,
      'timeZone', authorized_tournament.time_zone
    ),
    'scannerLinks',
    jsonb_build_object(
      'total', scanner_totals.total_links,
      'active', scanner_totals.active_links
    ),
    'sales',
    jsonb_build_object(
      'onlineOrderCount', paid_order_totals.order_count,
      'onlineTicketsSold', paid_order_item_totals.ticket_count,
      'grossOnlineSales',
        round(paid_order_totals.gross_revenue, 2),
      'estimatedStripeFees',
        round(
          paid_order_totals.gross_revenue * 0.029
          + paid_order_totals.order_count * 0.30,
          2
        ),
      'estimatedNetPayout',
        greatest(
          paid_order_totals.gross_revenue
          - round(
              paid_order_totals.gross_revenue * 0.029
              + paid_order_totals.order_count * 0.30,
              2
            ),
          0::numeric
        ),
      'manualSaleCount', manual_totals.sale_count,
      'manualAdmissions', manual_totals.admission_count,
      'manualSales', round(manual_totals.gross_revenue, 2),
      'totalEstimatedRevenue',
        round(
          paid_order_totals.gross_revenue
          + manual_totals.gross_revenue,
          2
        )
    ),
    'gate',
    jsonb_build_object(
      'totalScanAttempts', gate_totals.total_attempts,
      'successfulCheckIns', gate_totals.successful_check_ins,
      'duplicateAttempts', gate_totals.duplicate_attempts,
      'invalidAttempts', gate_totals.invalid_attempts,
      'wrongDayAttempts', gate_totals.wrong_day_attempts,
      'manualCheckIns', gate_totals.manual_check_ins,
      'overrides', gate_totals.overrides,
      'checkedInPasses', gate_totals.checked_in_passes,
      'unscannedPasses',
        greatest(
          paid_order_item_totals.ticket_count
          - gate_totals.checked_in_passes,
          0
        )
    ),
    'salesByTicketType',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'ticketTypeId', ticket_sale.id,
            'ticketName', ticket_sale.name,
            'onlineTickets', ticket_sale.online_tickets,
            'onlineRevenue', ticket_sale.online_revenue,
            'manualAdmissions', ticket_sale.manual_admissions,
            'manualRevenue', ticket_sale.manual_revenue,
            'totalAdmissions',
              ticket_sale.online_tickets + ticket_sale.manual_admissions,
            'totalRevenue',
              ticket_sale.online_revenue + ticket_sale.manual_revenue
          )
          order by
            ticket_sale.online_revenue + ticket_sale.manual_revenue desc,
            ticket_sale.name
        )
        from ticket_type_sales as ticket_sale
      ),
      '[]'::jsonb
    ),
    'salesByDay',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'date', daily_sale.sale_day,
            'onlineTickets', daily_sale.online_tickets,
            'onlineRevenue', daily_sale.online_revenue,
            'manualAdmissions', daily_sale.manual_admissions,
            'manualRevenue', daily_sale.manual_revenue,
            'totalAdmissions',
              daily_sale.online_tickets + daily_sale.manual_admissions,
            'totalRevenue',
              daily_sale.online_revenue + daily_sale.manual_revenue
          )
          order by daily_sale.sale_day desc
        )
        from daily_sales as daily_sale
      ),
      '[]'::jsonb
    )
  )
  from authorized_tournament
  cross join paid_order_totals
  cross join paid_order_item_totals
  cross join manual_totals
  cross join gate_totals
  cross join scanner_totals;
$$;

revoke all
  on function public.get_tournament_dashboard_metrics(bigint)
  from public, anon, authenticated;

grant execute
  on function public.get_tournament_dashboard_metrics(bigint)
  to authenticated;
