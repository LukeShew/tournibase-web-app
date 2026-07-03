-- Phase 10: permission-gated buyer and order lookup for gate staff.

create or replace function public.lookup_gate_orders(
  p_scanner_token_hash text,
  p_query text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_order_id bigint;
  v_orders jsonb;
  v_query text := lower(trim(coalesce(p_query, '')));
  v_scanner record;
begin
  if p_scanner_token_hash is null
    or p_scanner_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid scanner credential format.';
  end if;

  if char_length(v_query) < 2 or char_length(v_query) > 100 then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Enter at least 2 characters and no more than 100.'
    );
  end if;

  select
    scanner_session.id,
    scanner_session.tournament_id,
    scanner_session.permissions,
    scanner_session.expires_at,
    scanner_session.revoked_at,
    tournament.status as tournament_status
  into v_scanner
  from public.scanner_sessions as scanner_session
  join public.tournaments as tournament
    on tournament.id = scanner_session.tournament_id
  where scanner_session.token_hash = p_scanner_token_hash
  for update of scanner_session;

  if not found
    or v_scanner.revoked_at is not null
    or v_scanner.expires_at <= v_now
    or not ('lookup' = any(v_scanner.permissions))
    or v_scanner.tournament_status in ('closed', 'archived')
  then
    return jsonb_build_object(
      'status', 'scanner_unauthorized',
      'message', 'This scanner link is not authorized for manual lookup.'
    );
  end if;

  update public.scanner_sessions
  set last_active_at = v_now
  where id = v_scanner.id;

  if v_query ~* '^(tb-)?[0-9]+$'
    and char_length(regexp_replace(v_query, '^(tb-)?0*', '', 'i')) <= 18
  then
    v_order_id := coalesce(
      nullif(regexp_replace(v_query, '^(tb-)?0*', '', 'i'), ''),
      '0'
    )::bigint;
  end if;

  with matching_orders as (
    select customer_order.*
    from public.orders as customer_order
    where customer_order.tournament_id = v_scanner.tournament_id
      and exists (
        select 1
        from public.passes as candidate_pass
        where candidate_pass.order_id = customer_order.id
      )
      and (
        customer_order.id = v_order_id
        or position(v_query in lower(customer_order.buyer_name)) > 0
        or position(v_query in lower(customer_order.buyer_email)) > 0
        or position(
          v_query in lower(coalesce(customer_order.buyer_phone, ''))
        ) > 0
      )
    order by customer_order.created_at desc
    limit 10
  ),
  pass_summaries as (
    select
      candidate_pass.id,
      candidate_pass.order_id,
      candidate_pass.status,
      candidate_pass.valid_from,
      candidate_pass.valid_until,
      candidate_pass.uses_allowed,
      ticket_type.name as ticket_name,
      count(check_in.id) filter (
        where check_in.undone_at is null
          and check_in.result in (
            'valid',
            'manual_check_in',
            'override'
          )
      )::integer as admissions_used
    from public.passes as candidate_pass
    join matching_orders as customer_order
      on customer_order.id = candidate_pass.order_id
    join public.ticket_types as ticket_type
      on ticket_type.id = candidate_pass.ticket_type_id
    left join public.check_ins as check_in
      on check_in.pass_id = candidate_pass.id
    group by
      candidate_pass.id,
      ticket_type.name
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'orderId', customer_order.id,
        'orderNumber',
          'TB-' || lpad(customer_order.id::text, 6, '0'),
        'buyerName', customer_order.buyer_name,
        'buyerEmail', customer_order.buyer_email,
        'buyerPhone', customer_order.buyer_phone,
        'paymentStatus', customer_order.payment_status,
        'createdAt', customer_order.created_at,
        'unusedPasses', pass_totals.unused_passes,
        'scannedPasses', pass_totals.scanned_passes,
        'passes', pass_totals.passes
      )
      order by customer_order.created_at desc
    ),
    '[]'::jsonb
  )
  into v_orders
  from matching_orders as customer_order
  cross join lateral (
    select
      count(*) filter (
        where pass_summary.status = 'active'
          and pass_summary.admissions_used < pass_summary.uses_allowed
      )::integer as unused_passes,
      count(*) filter (
        where pass_summary.status = 'checked_in'
          or pass_summary.admissions_used >= pass_summary.uses_allowed
      )::integer as scanned_passes,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'passId', pass_summary.id,
            'ticketName', pass_summary.ticket_name,
            'status', pass_summary.status,
            'validFrom', pass_summary.valid_from,
            'validUntil', pass_summary.valid_until,
            'admissionsUsed', pass_summary.admissions_used,
            'usesAllowed', pass_summary.uses_allowed,
            'canCheckIn',
              customer_order.payment_status in ('paid', 'partial_refund')
              and pass_summary.status = 'active'
              and pass_summary.admissions_used
                < pass_summary.uses_allowed
          )
          order by pass_summary.id
        ),
        '[]'::jsonb
      ) as passes
    from pass_summaries as pass_summary
    where pass_summary.order_id = customer_order.id
  ) as pass_totals;

  return jsonb_build_object(
    'status', 'ok',
    'orders', v_orders
  );
end;
$$;

revoke all on function public.lookup_gate_orders(text, text)
  from public, anon, authenticated;
grant execute on function public.lookup_gate_orders(text, text)
  to service_role;
