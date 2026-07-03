-- Phase 12: secure tracking for cash and external gate sales.

alter table public.manual_sales
  add constraint manual_sales_buyer_name_length check (
    buyer_name is null or char_length(buyer_name) <= 160
  ),
  add constraint manual_sales_notes_length check (
    notes is null or char_length(notes) <= 500
  );

create or replace function public.record_gate_sale(
  p_scanner_token_hash text,
  p_ticket_type_id bigint,
  p_quantity integer,
  p_payment_method text,
  p_buyer_name text,
  p_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_amount numeric(10, 2);
  v_buyer_name text := nullif(trim(coalesce(p_buyer_name, '')), '');
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_now timestamptz := clock_timestamp();
  v_sale_id bigint;
  v_scanner record;
  v_ticket record;
begin
  if p_scanner_token_hash is null
    or p_scanner_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid scanner credential format.';
  end if;

  if p_ticket_type_id is null or p_ticket_type_id < 1 then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Choose a ticket type.'
    );
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Quantity must be between 1 and 100.'
    );
  end if;

  if p_payment_method not in (
    'cash',
    'venmo',
    'card_outside_tournibase',
    'comp'
  ) then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Choose a supported payment method.'
    );
  end if;

  if v_buyer_name is not null and char_length(v_buyer_name) > 160 then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Buyer name must be 160 characters or fewer.'
    );
  end if;

  if v_notes is not null and char_length(v_notes) > 500 then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Notes must be 500 characters or fewer.'
    );
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
    or not ('manual_sale' = any(v_scanner.permissions))
    or v_scanner.tournament_status in ('closed', 'archived')
  then
    return jsonb_build_object(
      'status', 'scanner_unauthorized',
      'message', 'This scanner link is not authorized to record gate sales.'
    );
  end if;

  select
    ticket_type.id,
    ticket_type.name,
    ticket_type.price,
    ticket_type.status
  into v_ticket
  from public.ticket_types as ticket_type
  where ticket_type.id = p_ticket_type_id
    and ticket_type.tournament_id = v_scanner.tournament_id;

  if not found or v_ticket.status <> 'active' then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'This ticket type is not available for gate sales.'
    );
  end if;

  v_amount := case
    when p_payment_method = 'comp' then 0
    else v_ticket.price * p_quantity
  end;

  insert into public.manual_sales (
    tournament_id,
    scanner_session_id,
    ticket_type_id,
    quantity,
    payment_method,
    amount,
    buyer_name,
    notes,
    created_at
  )
  values (
    v_scanner.tournament_id,
    v_scanner.id,
    v_ticket.id,
    p_quantity,
    p_payment_method::public.manual_sale_payment_method,
    v_amount,
    v_buyer_name,
    v_notes,
    v_now
  )
  returning id into v_sale_id;

  update public.scanner_sessions
  set last_active_at = v_now
  where id = v_scanner.id;

  return jsonb_build_object(
    'status', 'recorded',
    'saleId', v_sale_id,
    'tournamentName', v_scanner.tournament_name,
    'gateName', v_scanner.gate_name,
    'ticketName', v_ticket.name,
    'quantity', p_quantity,
    'paymentMethod', p_payment_method,
    'amount', v_amount,
    'buyerName', v_buyer_name,
    'recordedAt', v_now,
    'message', 'Gate sale recorded.'
  );
end;
$$;

revoke all on function public.record_gate_sale(
  text,
  bigint,
  integer,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.record_gate_sale(
  text,
  bigint,
  integer,
  text,
  text,
  text
) to service_role;
