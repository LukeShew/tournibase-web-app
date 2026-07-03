-- Phase 9: atomic scanner validation, complete attempt history, undo, and override.

alter table public.check_ins
  alter column pass_id drop not null,
  add column source text not null default 'camera',
  add column attempted_token_hash text,
  add column undone_at timestamptz,
  add column undone_by_scanner_session_id bigint
    references public.scanner_sessions (id) on delete restrict,
  add constraint check_ins_source_valid check (
    source in ('camera', 'manual')
  ),
  add constraint check_ins_attempted_token_hash_sha256 check (
    attempted_token_hash is null
    or attempted_token_hash ~ '^[0-9a-f]{64}$'
  ),
  add constraint check_ins_pass_presence check (
    pass_id is not null
    or result = 'invalid'
  ),
  add constraint check_ins_manual_source_valid check (
    result <> 'manual_check_in'
    or source = 'manual'
  ),
  add constraint check_ins_undo_fields_together check (
    (
      undone_at is null
      and undone_by_scanner_session_id is null
    )
    or (
      undone_at is not null
      and undone_by_scanner_session_id is not null
      and undone_at >= created_at
    )
  );

create index check_ins_active_admissions_idx
  on public.check_ins (pass_id, created_at)
  where undone_at is null
    and result in ('valid', 'manual_check_in', 'override');

create or replace function public.validate_pass_for_entry(
  p_scanner_token_hash text,
  p_pass_token uuid,
  p_attempted_token_hash text,
  p_source text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_admit_count bigint := 0;
  v_attempt_id bigint;
  v_check_in_id bigint;
  v_first_gate_name text;
  v_first_scanned_at timestamptz;
  v_now timestamptz := clock_timestamp();
  v_pass record;
  v_result public.check_in_result;
  v_scanner record;
begin
  if p_scanner_token_hash is null
    or p_scanner_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid scanner credential format.';
  end if;

  if p_attempted_token_hash is null
    or p_attempted_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid attempted token hash format.';
  end if;

  if p_source not in ('camera', 'manual') then
    raise exception 'Invalid scan source.';
  end if;

  select
    scanner_session.id,
    scanner_session.tournament_id,
    scanner_session.gate_name,
    scanner_session.permissions,
    scanner_session.expires_at,
    scanner_session.revoked_at,
    tournament.name as tournament_name,
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
    or not ('scan' = any(v_scanner.permissions))
    or v_scanner.tournament_status in ('closed', 'archived')
  then
    return jsonb_build_object(
      'status', 'scanner_unauthorized',
      'message', 'This scanner link is no longer authorized.'
    );
  end if;

  update public.scanner_sessions
  set last_active_at = v_now
  where id = v_scanner.id;

  if p_pass_token is null then
    insert into public.check_ins (
      pass_id,
      tournament_id,
      scanner_session_id,
      gate_name,
      result,
      source,
      attempted_token_hash,
      created_at
    )
    values (
      null,
      v_scanner.tournament_id,
      v_scanner.id,
      v_scanner.gate_name,
      'invalid',
      p_source,
      p_attempted_token_hash,
      v_now
    )
    returning id into v_attempt_id;

    return jsonb_build_object(
      'status', 'invalid',
      'attemptId', v_attempt_id,
      'message', 'This QR code does not match a TourniBase pass.'
    );
  end if;

  select
    candidate_pass.id,
    candidate_pass.order_id,
    candidate_pass.tournament_id,
    candidate_pass.status as pass_status,
    candidate_pass.valid_from,
    candidate_pass.valid_until,
    candidate_pass.uses_allowed,
    customer_order.payment_status,
    ticket_type.name as ticket_name,
    tournament.name as tournament_name
  into v_pass
  from public.passes as candidate_pass
  join public.orders as customer_order
    on customer_order.id = candidate_pass.order_id
  join public.ticket_types as ticket_type
    on ticket_type.id = candidate_pass.ticket_type_id
  join public.tournaments as tournament
    on tournament.id = candidate_pass.tournament_id
  where candidate_pass.public_token = p_pass_token
  for update of candidate_pass;

  if not found or v_pass.tournament_id <> v_scanner.tournament_id then
    insert into public.check_ins (
      pass_id,
      tournament_id,
      scanner_session_id,
      gate_name,
      result,
      source,
      attempted_token_hash,
      created_at
    )
    values (
      null,
      v_scanner.tournament_id,
      v_scanner.id,
      v_scanner.gate_name,
      'invalid',
      p_source,
      p_attempted_token_hash,
      v_now
    )
    returning id into v_attempt_id;

    return jsonb_build_object(
      'status', 'invalid',
      'attemptId', v_attempt_id,
      'message', 'This pass is not valid for this tournament.'
    );
  end if;

  if v_pass.payment_status = 'refunded' then
    insert into public.check_ins (
      pass_id,
      tournament_id,
      scanner_session_id,
      gate_name,
      result,
      source,
      attempted_token_hash,
      created_at
    )
    values (
      v_pass.id,
      v_scanner.tournament_id,
      v_scanner.id,
      v_scanner.gate_name,
      'refunded',
      p_source,
      p_attempted_token_hash,
      v_now
    )
    returning id into v_attempt_id;

    return jsonb_build_object(
      'status', 'not_active',
      'attemptId', v_attempt_id,
      'inactiveReason', 'refunded',
      'ticketName', v_pass.ticket_name,
      'message', 'This order has been refunded.'
    );
  end if;

  if v_pass.payment_status not in ('paid', 'partial_refund') then
    insert into public.check_ins (
      pass_id,
      tournament_id,
      scanner_session_id,
      gate_name,
      result,
      source,
      attempted_token_hash,
      created_at
    )
    values (
      v_pass.id,
      v_scanner.tournament_id,
      v_scanner.id,
      v_scanner.gate_name,
      'invalid',
      p_source,
      p_attempted_token_hash,
      v_now
    )
    returning id into v_attempt_id;

    return jsonb_build_object(
      'status', 'invalid',
      'attemptId', v_attempt_id,
      'message', 'The order for this pass is not paid.'
    );
  end if;

  if v_pass.pass_status in ('refunded', 'voided') then
    v_result := v_pass.pass_status::text::public.check_in_result;

    insert into public.check_ins (
      pass_id,
      tournament_id,
      scanner_session_id,
      gate_name,
      result,
      source,
      attempted_token_hash,
      created_at
    )
    values (
      v_pass.id,
      v_scanner.tournament_id,
      v_scanner.id,
      v_scanner.gate_name,
      v_result,
      p_source,
      p_attempted_token_hash,
      v_now
    )
    returning id into v_attempt_id;

    return jsonb_build_object(
      'status', 'not_active',
      'attemptId', v_attempt_id,
      'inactiveReason', v_pass.pass_status,
      'ticketName', v_pass.ticket_name,
      'message', case
        when v_pass.pass_status = 'refunded'
          then 'This pass has been refunded.'
        else 'This pass has been voided.'
      end
    );
  end if;

  if v_pass.pass_status = 'expired'
    or v_now < v_pass.valid_from
    or v_now > v_pass.valid_until
  then
    insert into public.check_ins (
      pass_id,
      tournament_id,
      scanner_session_id,
      gate_name,
      result,
      source,
      attempted_token_hash,
      created_at
    )
    values (
      v_pass.id,
      v_scanner.tournament_id,
      v_scanner.id,
      v_scanner.gate_name,
      'wrong_day',
      p_source,
      p_attempted_token_hash,
      v_now
    )
    returning id into v_attempt_id;

    return jsonb_build_object(
      'status', 'wrong_day',
      'attemptId', v_attempt_id,
      'passId', v_pass.id,
      'ticketName', v_pass.ticket_name,
      'validFrom', v_pass.valid_from,
      'validUntil', v_pass.valid_until,
      'message', 'This pass is not valid at the current time.'
    );
  end if;

  select count(*)
  into v_admit_count
  from public.check_ins as check_in
  where check_in.pass_id = v_pass.id
    and check_in.undone_at is null
    and check_in.result in ('valid', 'manual_check_in', 'override');

  if v_pass.pass_status = 'checked_in'
    or v_admit_count >= v_pass.uses_allowed
  then
    select
      check_in.created_at,
      check_in.gate_name
    into
      v_first_scanned_at,
      v_first_gate_name
    from public.check_ins as check_in
    where check_in.pass_id = v_pass.id
      and check_in.undone_at is null
      and check_in.result in ('valid', 'manual_check_in', 'override')
    order by check_in.created_at asc
    limit 1;

    insert into public.check_ins (
      pass_id,
      tournament_id,
      scanner_session_id,
      gate_name,
      result,
      source,
      attempted_token_hash,
      created_at
    )
    values (
      v_pass.id,
      v_scanner.tournament_id,
      v_scanner.id,
      v_scanner.gate_name,
      'already_used',
      p_source,
      p_attempted_token_hash,
      v_now
    )
    returning id into v_attempt_id;

    return jsonb_build_object(
      'status', 'already_used',
      'attemptId', v_attempt_id,
      'passId', v_pass.id,
      'ticketName', v_pass.ticket_name,
      'firstScannedAt', v_first_scanned_at,
      'firstGateName', v_first_gate_name,
      'admitCount', v_admit_count,
      'usesAllowed', v_pass.uses_allowed,
      'message', 'This pass has already reached its admission limit.'
    );
  end if;

  v_result := case
    when p_source = 'manual' then 'manual_check_in'::public.check_in_result
    else 'valid'::public.check_in_result
  end;

  insert into public.check_ins (
    pass_id,
    tournament_id,
    scanner_session_id,
    gate_name,
    result,
    source,
    attempted_token_hash,
    created_at
  )
  values (
    v_pass.id,
    v_scanner.tournament_id,
    v_scanner.id,
    v_scanner.gate_name,
    v_result,
    p_source,
    p_attempted_token_hash,
    v_now
  )
  returning id into v_check_in_id;

  v_admit_count := v_admit_count + 1;

  if v_admit_count >= v_pass.uses_allowed then
    update public.passes
    set status = 'checked_in'
    where id = v_pass.id;
  end if;

  return jsonb_build_object(
    'status', 'valid',
    'checkInId', v_check_in_id,
    'passId', v_pass.id,
    'ticketName', v_pass.ticket_name,
    'tournamentName', v_pass.tournament_name,
    'gateName', v_scanner.gate_name,
    'checkInTime', v_now,
    'admitCount', v_admit_count,
    'usesAllowed', v_pass.uses_allowed,
    'wasManual', p_source = 'manual',
    'wasOverride', false,
    'message', 'Pass admitted successfully.'
  );
end;
$$;

revoke all on function public.validate_pass_for_entry(text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.validate_pass_for_entry(text, uuid, text, text)
  to service_role;

create or replace function public.undo_pass_check_in(
  p_scanner_token_hash text,
  p_check_in_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_check_in record;
  v_now timestamptz := clock_timestamp();
  v_remaining_admissions bigint;
  v_scanner record;
begin
  if p_scanner_token_hash is null
    or p_scanner_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid scanner credential format.';
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
    or not ('scan' = any(v_scanner.permissions))
    or v_scanner.tournament_status in ('closed', 'archived')
  then
    return jsonb_build_object(
      'status', 'scanner_unauthorized',
      'message', 'This scanner link is no longer authorized.'
    );
  end if;

  update public.scanner_sessions
  set last_active_at = v_now
  where id = v_scanner.id;

  select
    check_in.id,
    check_in.pass_id,
    check_in.tournament_id,
    check_in.result,
    check_in.undone_at,
    candidate_pass.status as pass_status,
    candidate_pass.uses_allowed,
    ticket_type.name as ticket_name,
    tournament.name as tournament_name
  into v_check_in
  from public.check_ins as check_in
  join public.passes as candidate_pass
    on candidate_pass.id = check_in.pass_id
  join public.ticket_types as ticket_type
    on ticket_type.id = candidate_pass.ticket_type_id
  join public.tournaments as tournament
    on tournament.id = check_in.tournament_id
  where check_in.id = p_check_in_id
  for update of check_in, candidate_pass;

  if not found
    or v_check_in.tournament_id <> v_scanner.tournament_id
    or v_check_in.result not in ('valid', 'manual_check_in', 'override')
  then
    return jsonb_build_object(
      'status', 'not_found',
      'message', 'This check-in cannot be undone from this scanner.'
    );
  end if;

  if v_check_in.undone_at is not null then
    return jsonb_build_object(
      'status', 'already_undone',
      'message', 'This check-in was already undone.'
    );
  end if;

  update public.check_ins
  set
    undone_at = v_now,
    undone_by_scanner_session_id = v_scanner.id
  where id = v_check_in.id;

  select count(*)
  into v_remaining_admissions
  from public.check_ins as check_in
  where check_in.pass_id = v_check_in.pass_id
    and check_in.undone_at is null
    and check_in.result in ('valid', 'manual_check_in', 'override');

  if v_remaining_admissions < v_check_in.uses_allowed
    and v_check_in.pass_status = 'checked_in'
  then
    update public.passes
    set status = 'active'
    where id = v_check_in.pass_id
      and status = 'checked_in';
  end if;

  return jsonb_build_object(
    'status', 'undone',
    'passId', v_check_in.pass_id,
    'ticketName', v_check_in.ticket_name,
    'tournamentName', v_check_in.tournament_name,
    'undoneAt', v_now,
    'remainingAdmissions', v_remaining_admissions,
    'message', 'The check-in was undone.'
  );
end;
$$;

revoke all on function public.undo_pass_check_in(text, bigint)
  from public, anon, authenticated;
grant execute on function public.undo_pass_check_in(text, bigint)
  to service_role;

create or replace function public.override_duplicate_pass_entry(
  p_scanner_token_hash text,
  p_pass_id bigint,
  p_attempted_token_hash text,
  p_source text,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_admit_count bigint;
  v_check_in_id bigint;
  v_now timestamptz := clock_timestamp();
  v_pass record;
  v_scanner record;
begin
  if p_scanner_token_hash is null
    or p_scanner_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid scanner credential format.';
  end if;

  if p_attempted_token_hash is null
    or p_attempted_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid attempted token hash format.';
  end if;

  if p_source not in ('camera', 'manual') then
    raise exception 'Invalid scan source.';
  end if;

  if p_reason is null
    or char_length(trim(p_reason)) < 3
    or char_length(trim(p_reason)) > 500
  then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Enter an override reason between 3 and 500 characters.'
    );
  end if;

  select
    scanner_session.id,
    scanner_session.tournament_id,
    scanner_session.gate_name,
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
    or not ('scan' = any(v_scanner.permissions))
    or v_scanner.tournament_status in ('closed', 'archived')
  then
    return jsonb_build_object(
      'status', 'scanner_unauthorized',
      'message', 'This scanner link is no longer authorized.'
    );
  end if;

  update public.scanner_sessions
  set last_active_at = v_now
  where id = v_scanner.id;

  select
    candidate_pass.id,
    candidate_pass.status as pass_status,
    candidate_pass.valid_from,
    candidate_pass.valid_until,
    candidate_pass.uses_allowed,
    customer_order.payment_status,
    ticket_type.name as ticket_name,
    tournament.name as tournament_name
  into v_pass
  from public.passes as candidate_pass
  join public.orders as customer_order
    on customer_order.id = candidate_pass.order_id
  join public.ticket_types as ticket_type
    on ticket_type.id = candidate_pass.ticket_type_id
  join public.tournaments as tournament
    on tournament.id = candidate_pass.tournament_id
  where candidate_pass.id = p_pass_id
    and candidate_pass.tournament_id = v_scanner.tournament_id
  for update of candidate_pass;

  if not found
    or v_pass.payment_status not in ('paid', 'partial_refund')
    or v_pass.pass_status in ('refunded', 'voided', 'expired')
    or v_now < v_pass.valid_from
    or v_now > v_pass.valid_until
  then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'This pass is not eligible for a duplicate-entry override.'
    );
  end if;

  select count(*)
  into v_admit_count
  from public.check_ins as check_in
  where check_in.pass_id = v_pass.id
    and check_in.undone_at is null
    and check_in.result in ('valid', 'manual_check_in', 'override');

  if v_pass.pass_status <> 'checked_in'
    and v_admit_count < v_pass.uses_allowed
  then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'This pass has not reached its admission limit.'
    );
  end if;

  insert into public.check_ins (
    pass_id,
    tournament_id,
    scanner_session_id,
    gate_name,
    result,
    override_reason,
    source,
    attempted_token_hash,
    created_at
  )
  values (
    v_pass.id,
    v_scanner.tournament_id,
    v_scanner.id,
    v_scanner.gate_name,
    'override',
    trim(p_reason),
    p_source,
    p_attempted_token_hash,
    v_now
  )
  returning id into v_check_in_id;

  v_admit_count := v_admit_count + 1;

  update public.passes
  set status = 'checked_in'
  where id = v_pass.id;

  return jsonb_build_object(
    'status', 'valid',
    'checkInId', v_check_in_id,
    'passId', v_pass.id,
    'ticketName', v_pass.ticket_name,
    'tournamentName', v_pass.tournament_name,
    'gateName', v_scanner.gate_name,
    'checkInTime', v_now,
    'admitCount', v_admit_count,
    'usesAllowed', v_pass.uses_allowed,
    'wasManual', p_source = 'manual',
    'wasOverride', true,
    'message', 'Duplicate admission override recorded.'
  );
end;
$$;

revoke all on function public.override_duplicate_pass_entry(
  text,
  bigint,
  text,
  text,
  text
)
  from public, anon, authenticated;
grant execute on function public.override_duplicate_pass_entry(
  text,
  bigint,
  text,
  text,
  text
)
  to service_role;
