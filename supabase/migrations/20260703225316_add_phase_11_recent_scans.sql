-- Phase 11: persisted recent activity for each scanner session.

create index check_ins_scanner_session_created_at_idx
  on public.check_ins (scanner_session_id, created_at desc);

create or replace function public.get_recent_scans(
  p_scanner_token_hash text,
  p_limit integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_scanner record;
  v_scans jsonb;
begin
  if p_scanner_token_hash is null
    or p_scanner_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid scanner credential format.';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 100 then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Recent scan limit must be between 1 and 100.'
    );
  end if;

  select
    scanner_session.id,
    scanner_session.tournament_id,
    scanner_session.permissions,
    scanner_session.expires_at,
    scanner_session.revoked_at,
    tournament.status as tournament_status,
    tournament.time_zone
  into v_scanner
  from public.scanner_sessions as scanner_session
  join public.tournaments as tournament
    on tournament.id = scanner_session.tournament_id
  where scanner_session.token_hash = p_scanner_token_hash
  for update of scanner_session;

  if not found
    or v_scanner.revoked_at is not null
    or v_scanner.expires_at <= v_now
    or not ('recent' = any(v_scanner.permissions))
    or v_scanner.tournament_status in ('closed', 'archived')
  then
    return jsonb_build_object(
      'status', 'scanner_unauthorized',
      'message', 'This scanner link is not authorized to view recent scans.'
    );
  end if;

  update public.scanner_sessions
  set last_active_at = v_now
  where id = v_scanner.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'checkInId', recent_scan.id,
        'scannedAt', recent_scan.created_at,
        'result', recent_scan.result,
        'ticketName', recent_scan.ticket_name,
        'buyerName', recent_scan.buyer_name,
        'gateName', recent_scan.gate_name,
        'source', recent_scan.source,
        'wasOverride', recent_scan.result = 'override',
        'overrideReason', recent_scan.override_reason,
        'wasUndone', recent_scan.undone_at is not null
      )
      order by recent_scan.created_at desc
    ),
    '[]'::jsonb
  )
  into v_scans
  from (
    select
      check_in.id,
      check_in.created_at,
      check_in.result,
      check_in.gate_name,
      check_in.source,
      check_in.override_reason,
      check_in.undone_at,
      ticket_type.name as ticket_name,
      customer_order.buyer_name
    from public.check_ins as check_in
    left join public.passes as candidate_pass
      on candidate_pass.id = check_in.pass_id
    left join public.ticket_types as ticket_type
      on ticket_type.id = candidate_pass.ticket_type_id
    left join public.orders as customer_order
      on customer_order.id = candidate_pass.order_id
    where check_in.scanner_session_id = v_scanner.id
    order by check_in.created_at desc
    limit p_limit
  ) as recent_scan;

  return jsonb_build_object(
    'status', 'ok',
    'timeZone', v_scanner.time_zone,
    'scans', v_scans
  );
end;
$$;

revoke all on function public.get_recent_scans(text, integer)
  from public, anon, authenticated;
grant execute on function public.get_recent_scans(text, integer)
  to service_role;
