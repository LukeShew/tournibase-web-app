-- Pilot hardening: atomic ticket reservations, refund-aware reporting,
-- cross-table integrity, public rate limits, and date-safe event editing.

alter table public.orders
  add column amount_refunded numeric(10, 2) not null default 0,
  add column inventory_expires_at timestamptz,
  add constraint orders_amount_refunded_valid check (
    amount_refunded >= 0 and amount_refunded <= amount_total
  );

update public.orders
set inventory_expires_at = created_at + interval '30 minutes'
where payment_status = 'pending'
  and inventory_expires_at is null;

alter table public.order_items
  add column tournament_id bigint;

update public.order_items as order_item
set tournament_id = customer_order.tournament_id
from public.orders as customer_order
where customer_order.id = order_item.order_id;

alter table public.order_items
  alter column tournament_id set not null;

-- Composite keys make it impossible for a pass, order item, check-in, scanner,
-- or manual sale to claim a tournament different from its parent records.
alter table public.orders
  add constraint orders_id_tournament_unique unique (id, tournament_id);
alter table public.ticket_types
  add constraint ticket_types_id_tournament_unique unique (id, tournament_id);
alter table public.scanner_sessions
  add constraint scanner_sessions_id_tournament_unique unique (id, tournament_id);
alter table public.order_items
  add constraint order_items_id_order_tournament_ticket_unique
    unique (id, order_id, tournament_id, ticket_type_id),
  add constraint order_items_order_tournament_fk
    foreign key (order_id, tournament_id)
    references public.orders (id, tournament_id) on delete cascade,
  add constraint order_items_ticket_tournament_fk
    foreign key (ticket_type_id, tournament_id)
    references public.ticket_types (id, tournament_id) on delete restrict;
alter table public.passes
  add constraint passes_id_tournament_unique unique (id, tournament_id),
  add constraint passes_order_tournament_fk
    foreign key (order_id, tournament_id)
    references public.orders (id, tournament_id) on delete restrict,
  add constraint passes_ticket_tournament_fk
    foreign key (ticket_type_id, tournament_id)
    references public.ticket_types (id, tournament_id) on delete restrict,
  add constraint passes_order_item_relationship_fk
    foreign key (order_item_id, order_id, tournament_id, ticket_type_id)
    references public.order_items (id, order_id, tournament_id, ticket_type_id)
    on delete restrict;
alter table public.check_ins
  add constraint check_ins_pass_tournament_fk
    foreign key (pass_id, tournament_id)
    references public.passes (id, tournament_id) on delete restrict,
  add constraint check_ins_scanner_tournament_fk
    foreign key (scanner_session_id, tournament_id)
    references public.scanner_sessions (id, tournament_id) on delete restrict;
alter table public.manual_sales
  add constraint manual_sales_scanner_tournament_fk
    foreign key (scanner_session_id, tournament_id)
    references public.scanner_sessions (id, tournament_id) on delete restrict,
  add constraint manual_sales_ticket_tournament_fk
    foreign key (ticket_type_id, tournament_id)
    references public.ticket_types (id, tournament_id) on delete restrict;

create index order_items_tournament_id_idx
  on public.order_items (tournament_id);
create index orders_pending_inventory_idx
  on public.orders (inventory_expires_at)
  where payment_status = 'pending';

-- Public requests use this service-role-only bucket. RLS prevents direct API
-- access and the function validates every caller-supplied bound.
create table public.rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null,
  updated_at timestamptz not null default now(),
  constraint rate_limit_bucket_key_not_blank check (
    char_length(trim(bucket_key)) between 1 and 240
  ),
  constraint rate_limit_request_count_positive check (request_count > 0)
);

alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on public.rate_limit_buckets to service_role;

create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed boolean;
  v_now timestamptz := clock_timestamp();
begin
  if p_bucket_key is null
    or char_length(trim(p_bucket_key)) < 1
    or char_length(p_bucket_key) > 240
    or p_max_requests < 1
    or p_max_requests > 10000
    or p_window_seconds < 1
    or p_window_seconds > 86400
  then
    raise exception 'Invalid rate-limit request.';
  end if;

  insert into public.rate_limit_buckets (
    bucket_key,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_bucket_key, v_now, 1, v_now)
  on conflict (bucket_key) do update
  set
    window_started_at = case
      when public.rate_limit_buckets.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      then v_now
      else public.rate_limit_buckets.window_started_at
    end,
    request_count = case
      when public.rate_limit_buckets.window_started_at
        <= v_now - make_interval(secs => p_window_seconds)
      then 1
      else public.rate_limit_buckets.request_count + 1
    end,
    updated_at = v_now
  returning request_count <= p_max_requests into v_allowed;

  return v_allowed;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer)
  to service_role;

-- Reserve inventory and create the pending order in one transaction. Ticket
-- rows are locked in ID order, so simultaneous checkout requests cannot both
-- claim the last available units.
create or replace function public.reserve_checkout_order(
  p_event_slug text,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_buyer_team_name text,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_amount_total_cents bigint := 0;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_now timestamptz := clock_timestamp();
  v_order_id bigint;
  v_quantity integer;
  v_reserved_quantity bigint;
  v_ticket record;
  v_ticket_id bigint;
  v_tournament record;
begin
  if p_event_slug is null
    or p_event_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or p_buyer_name is null
    or char_length(trim(p_buyer_name)) < 1
    or char_length(trim(p_buyer_name)) > 160
    or p_buyer_email is null
    or char_length(trim(p_buyer_email)) < 3
    or char_length(trim(p_buyer_email)) > 254
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 20
  then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Check the buyer information and ticket quantities.'
    );
  end if;

  select
    tournament.id,
    tournament.name,
    tournament.public_slug,
    tournament.status,
    tournament.time_zone
  into v_tournament
  from public.tournaments as tournament
  where tournament.public_slug = p_event_slug
  for update of tournament;

  if not found or v_tournament.status <> 'published' then
    return jsonb_build_object(
      'status', 'event_unavailable',
      'message', 'This event is not currently accepting online orders.'
    );
  end if;

  if (
    select count(distinct (item.value->>'ticket_type_id'))
    from jsonb_array_elements(p_items) as item(value)
  ) <> jsonb_array_length(p_items) then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Each ticket type can appear only once per order.'
    );
  end if;

  for v_item in
    select item.value
    from jsonb_array_elements(p_items) as item(value)
    order by (item.value->>'ticket_type_id')::bigint
  loop
    begin
      v_ticket_id := (v_item->>'ticket_type_id')::bigint;
      v_quantity := (v_item->>'quantity')::integer;
    exception when others then
      return jsonb_build_object(
        'status', 'invalid_request',
        'message', 'Check the selected ticket quantities.'
      );
    end;

    if v_ticket_id < 1 or v_quantity < 1 or v_quantity > 10 then
      return jsonb_build_object(
        'status', 'invalid_request',
        'message', 'Choose between 1 and 10 of each ticket type.'
      );
    end if;

    select
      ticket_type.id,
      ticket_type.name,
      ticket_type.description,
      ticket_type.price,
      ticket_type.quantity_limit,
      ticket_type.status,
      ticket_type.valid_from,
      ticket_type.valid_until
    into v_ticket
    from public.ticket_types as ticket_type
    where ticket_type.id = v_ticket_id
      and ticket_type.tournament_id = v_tournament.id
    for update of ticket_type;

    if not found or v_ticket.status <> 'active' then
      return jsonb_build_object(
        'status', 'ticket_unavailable',
        'message', 'One or more selected tickets are no longer available.'
      );
    end if;

    if v_ticket.valid_until < v_now then
      return jsonb_build_object(
        'status', 'ticket_expired',
        'message', v_ticket.name || ' is no longer available for purchase.'
      );
    end if;

    if v_ticket.quantity_limit is not null then
      select coalesce(sum(order_item.quantity), 0)
      into v_reserved_quantity
      from public.order_items as order_item
      join public.orders as customer_order
        on customer_order.id = order_item.order_id
      where order_item.ticket_type_id = v_ticket.id
        and (
          customer_order.payment_status in ('paid', 'partial_refund')
          or (
            customer_order.payment_status = 'pending'
            and customer_order.inventory_expires_at > v_now
          )
        );

      select v_reserved_quantity + coalesce(sum(manual_sale.quantity), 0)
      into v_reserved_quantity
      from public.manual_sales as manual_sale
      where manual_sale.ticket_type_id = v_ticket.id;

      if v_reserved_quantity + v_quantity > v_ticket.quantity_limit then
        return jsonb_build_object(
          'status', 'sold_out',
          'message', v_ticket.name || ' does not have enough passes remaining.'
        );
      end if;
    end if;

    v_amount_total_cents := v_amount_total_cents
      + round(v_ticket.price * 100)::bigint * v_quantity;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'ticket_type_id', v_ticket.id,
      'name', v_ticket.name,
      'description', v_ticket.description,
      'unit_amount_cents', round(v_ticket.price * 100)::integer,
      'quantity', v_quantity,
      'valid_from', v_ticket.valid_from,
      'valid_until', v_ticket.valid_until
    ));
  end loop;

  insert into public.orders (
    tournament_id,
    buyer_name,
    buyer_email,
    buyer_phone,
    buyer_team_name,
    amount_total,
    payment_status,
    inventory_expires_at
  )
  values (
    v_tournament.id,
    trim(p_buyer_name),
    lower(trim(p_buyer_email)),
    nullif(trim(coalesce(p_buyer_phone, '')), ''),
    nullif(trim(coalesce(p_buyer_team_name, '')), ''),
    (v_amount_total_cents / 100.0)::numeric(10, 2),
    'pending',
    v_now + interval '31 minutes'
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id,
    tournament_id,
    ticket_type_id,
    ticket_name,
    unit_amount_cents,
    quantity,
    valid_from,
    valid_until
  )
  select
    v_order_id,
    v_tournament.id,
    (item.value->>'ticket_type_id')::bigint,
    item.value->>'name',
    (item.value->>'unit_amount_cents')::integer,
    (item.value->>'quantity')::integer,
    (item.value->>'valid_from')::timestamptz,
    (item.value->>'valid_until')::timestamptz
  from jsonb_array_elements(v_items) as item(value);

  return jsonb_build_object(
    'status', 'reserved',
    'order_id', v_order_id,
    'tournament_id', v_tournament.id,
    'tournament_name', v_tournament.name,
    'public_slug', v_tournament.public_slug,
    'amount_total_cents', v_amount_total_cents,
    'inventory_expires_at', v_now + interval '31 minutes',
    'items', v_items
  );
end;
$$;

revoke all on function public.reserve_checkout_order(
  text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.reserve_checkout_order(
  text, text, text, text, text, jsonb
) to service_role;

create or replace function public.enforce_ticket_event_dates()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tournament record;
begin
  select start_date, end_date, time_zone
  into v_tournament
  from public.tournaments
  where id = new.tournament_id;

  if (new.valid_from at time zone v_tournament.time_zone)::date
      < v_tournament.start_date
    or (new.valid_until at time zone v_tournament.time_zone)::date
      > v_tournament.end_date
  then
    raise exception 'Ticket dates must stay within the event dates.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger ticket_types_event_dates_guard
before insert or update of tournament_id, valid_from, valid_until
on public.ticket_types
for each row execute function public.enforce_ticket_event_dates();

create or replace function public.enforce_event_ticket_dates()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.start_date, new.end_date, new.time_zone)
    is distinct from (old.start_date, old.end_date, old.time_zone)
    and exists (
      select 1
      from public.ticket_types as ticket_type
      where ticket_type.tournament_id = new.id
        and (
          (ticket_type.valid_from at time zone new.time_zone)::date
            < new.start_date
          or (ticket_type.valid_until at time zone new.time_zone)::date
            > new.end_date
        )
    )
  then
    raise exception 'Update ticket dates before narrowing the event dates.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger tournaments_ticket_dates_guard
before update of start_date, end_date, time_zone
on public.tournaments
for each row execute function public.enforce_event_ticket_dates();

-- Public users should not receive expired tickets through the Data API.
drop policy if exists ticket_types_public_select on public.ticket_types;
create policy ticket_types_public_select
  on public.ticket_types
  for select
  to anon
  using (
    status = 'active'
    and valid_until >= current_timestamp
    and exists (
      select 1
      from public.tournaments as tournament
      where tournament.id = ticket_types.tournament_id
        and tournament.status = 'published'
    )
  );

drop policy if exists ticket_types_authenticated_select on public.ticket_types;
create policy ticket_types_authenticated_select
  on public.ticket_types
  for select
  to authenticated
  using (
    (
      status = 'active'
      and valid_until >= current_timestamp
      and exists (
        select 1
        from public.tournaments as tournament
        where tournament.id = ticket_types.tournament_id
          and tournament.status = 'published'
      )
    )
    or exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = ticket_types.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

-- Manual gate sales remain available, but now obey the same validity and
-- quantity rules as online sales. The ticket row lock coordinates both paths.
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
  v_reserved_quantity bigint := 0;
  v_sale_id bigint;
  v_scanner record;
  v_ticket record;
begin
  if p_scanner_token_hash is null
    or p_scanner_token_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'Invalid scanner credential format.';
  end if;
  if p_ticket_type_id is null or p_ticket_type_id < 1
    or p_quantity is null or p_quantity < 1 or p_quantity > 100
    or p_payment_method not in (
      'cash', 'venmo', 'card_outside_tournibase', 'comp'
    )
    or (v_buyer_name is not null and char_length(v_buyer_name) > 160)
    or (v_notes is not null and char_length(v_notes) > 500)
  then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Check the gate sale details and try again.'
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
    ticket_type.status,
    ticket_type.valid_from,
    ticket_type.valid_until,
    ticket_type.quantity_limit
  into v_ticket
  from public.ticket_types as ticket_type
  where ticket_type.id = p_ticket_type_id
    and ticket_type.tournament_id = v_scanner.tournament_id
  for update of ticket_type;

  if not found or v_ticket.status <> 'active' then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'This ticket type is not available for gate sales.'
    );
  end if;

  if v_now < v_ticket.valid_from or v_now > v_ticket.valid_until then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'This ticket is not valid for admission right now.'
    );
  end if;

  if v_ticket.quantity_limit is not null then
    select coalesce(sum(order_item.quantity), 0)
    into v_reserved_quantity
    from public.order_items as order_item
    join public.orders as customer_order
      on customer_order.id = order_item.order_id
    where order_item.ticket_type_id = v_ticket.id
      and (
        customer_order.payment_status in ('paid', 'partial_refund')
        or (
          customer_order.payment_status = 'pending'
          and customer_order.inventory_expires_at > v_now
        )
      );

    select v_reserved_quantity + coalesce(sum(manual_sale.quantity), 0)
    into v_reserved_quantity
    from public.manual_sales as manual_sale
    where manual_sale.ticket_type_id = v_ticket.id;

    if v_reserved_quantity + p_quantity > v_ticket.quantity_limit then
      return jsonb_build_object(
        'status', 'invalid_request',
        'message', 'This ticket type does not have enough admissions remaining.'
      );
    end if;
  end if;

  v_amount := case
    when p_payment_method = 'comp' then 0
    else v_ticket.price * p_quantity
  end;

  insert into public.manual_sales (
    tournament_id, scanner_session_id, ticket_type_id, quantity,
    payment_method, amount, buyer_name, notes, created_at
  )
  values (
    v_scanner.tournament_id, v_scanner.id, v_ticket.id, p_quantity,
    p_payment_method::public.manual_sale_payment_method, v_amount,
    v_buyer_name, v_notes, v_now
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
  text, bigint, integer, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_gate_sale(
  text, bigint, integer, text, text, text
) to service_role;

-- Refund-aware sales and admission metrics. Online revenue is the amount
-- still collected after refunds. Stripe fee estimates remain based on the
-- original captured amount because processing fees are generally not returned.
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
      customer_order.amount_refunded,
      greatest(
        customer_order.amount_total - customer_order.amount_refunded,
        0::numeric
      )::numeric(12, 2) as net_amount,
      customer_order.created_at
    from public.orders as customer_order
    where customer_order.tournament_id = p_tournament_id
      and customer_order.payment_status in ('paid', 'partial_refund')
      and exists (select 1 from authorized_tournament)
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
          when paid_order.amount_total > 0 then
            (order_item.unit_amount_cents / 100.0)
              * (paid_order.net_amount / paid_order.amount_total)
          else 0
        end
      ), 0::numeric)::numeric(12, 2) as net_revenue
    from eligible_passes as eligible_pass
    join public.order_items as order_item on order_item.id = eligible_pass.order_item_id
    join paid_orders as paid_order on paid_order.id = order_item.order_id
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
      'onlineOrderCount', paid_order_totals.order_count,
      'onlineTicketsSold', eligible_pass_totals.ticket_count,
      'grossOnlineSales', round(paid_order_totals.net_revenue, 2),
      'estimatedStripeFees', round(
        paid_order_totals.captured_revenue * 0.029
          + paid_order_totals.order_count * 0.30,
        2
      ),
      'estimatedNetPayout', greatest(
        paid_order_totals.net_revenue
          - round(
              paid_order_totals.captured_revenue * 0.029
                + paid_order_totals.order_count * 0.30,
              2
            ),
        0::numeric
      ),
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
  cross join paid_order_totals
  cross join eligible_pass_totals
  cross join manual_totals
  cross join gate_totals
  cross join scanner_totals;
$$;

revoke all on function public.get_tournament_dashboard_metrics(bigint)
  from public, anon, authenticated;
grant execute on function public.get_tournament_dashboard_metrics(bigint)
  to authenticated;
