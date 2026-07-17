-- Stripe Connect foundation.
-- Directors can read the connected-account state for organizations they own.
-- Only the service role can create or synchronize Stripe account records.

create table public.organization_stripe_accounts (
  id bigint generated always as identity primary key,
  organization_id bigint not null
    references public.organizations (id) on delete cascade,
  stripe_account_id text not null,
  stripe_environment text not null,
  onboarding_complete boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  card_payments_status text not null default 'inactive',
  payouts_status text not null default 'inactive',
  requirements_currently_due text[] not null default '{}'::text[],
  requirements_past_due text[] not null default '{}'::text[],
  requirements_eventually_due text[] not null default '{}'::text[],
  requirements_pending_verification text[] not null default '{}'::text[],
  account_closed boolean not null default false,
  disabled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz,
  constraint organization_stripe_accounts_account_not_blank check (
    char_length(trim(stripe_account_id)) > 0
  ),
  constraint organization_stripe_accounts_environment_valid check (
    stripe_environment in ('test', 'live')
  ),
  constraint organization_stripe_accounts_card_status_not_blank check (
    char_length(trim(card_payments_status)) > 0
  ),
  constraint organization_stripe_accounts_payouts_status_not_blank check (
    char_length(trim(payouts_status)) > 0
  ),
  constraint organization_stripe_accounts_disabled_reason_not_blank check (
    disabled_reason is null or char_length(trim(disabled_reason)) > 0
  ),
  constraint organization_stripe_accounts_org_environment_unique
    unique (organization_id, stripe_environment),
  constraint organization_stripe_accounts_stripe_account_unique
    unique (stripe_account_id)
);

create index organization_stripe_accounts_ready_lookup_idx
  on public.organization_stripe_accounts (
    organization_id,
    stripe_environment,
    charges_enabled,
    payouts_enabled
  );

comment on table public.organization_stripe_accounts is
  'Stripe Connect account state for one organization in one Stripe environment.';
comment on column public.organization_stripe_accounts.stripe_account_id is
  'Stripe connected account identifier. This is never exposed to anonymous users.';
comment on column public.organization_stripe_accounts.stripe_environment is
  'Stripe environment for this account: test or live. Test accounts are not reused in live mode.';
comment on column public.organization_stripe_accounts.card_payments_status is
  'Latest raw Accounts v2 card-payments capability status returned by Stripe.';
comment on column public.organization_stripe_accounts.payouts_status is
  'Latest raw Accounts v2 Stripe-balance payouts capability status returned by Stripe.';
comment on column public.organization_stripe_accounts.requirements_currently_due is
  'Latest Stripe requirement identifiers that currently block or require account action.';
comment on column public.organization_stripe_accounts.requirements_past_due is
  'Latest Stripe requirement identifiers that are past due.';
comment on column public.organization_stripe_accounts.requirements_eventually_due is
  'Latest Stripe requirement identifiers that will eventually require account action.';
comment on column public.organization_stripe_accounts.requirements_pending_verification is
  'Latest Stripe requirement identifiers awaiting verification.';
comment on column public.organization_stripe_accounts.account_closed is
  'Whether Stripe reports that the connected account has been permanently closed.';
comment on column public.organization_stripe_accounts.last_synced_at is
  'Time the server last synchronized this row from Stripe.';

alter table public.organization_stripe_accounts enable row level security;

create policy organization_stripe_accounts_director_select
  on public.organization_stripe_accounts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organizations as organization
      join public.users as app_user
        on app_user.id = organization.owner_user_id
      where organization.id = organization_stripe_accounts.organization_id
        and organization.owner_user_id = (select auth.uid())
        and app_user.role = 'director'
    )
  );

revoke all on public.organization_stripe_accounts
  from public, anon, authenticated;
revoke all on sequence public.organization_stripe_accounts_id_seq
  from public, anon, authenticated;

grant select on public.organization_stripe_accounts to authenticated;
grant select, insert, update, delete
  on public.organization_stripe_accounts
  to service_role;
grant usage, select
  on sequence public.organization_stripe_accounts_id_seq
  to service_role;

create or replace function private.set_row_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function private.set_row_updated_at()
  from public, anon, authenticated;

create trigger organization_stripe_accounts_set_updated_at
  before update on public.organization_stripe_accounts
  for each row
  execute function private.set_row_updated_at();

create or replace function public.organization_stripe_account_is_ready(
  p_organization_id bigint,
  p_stripe_environment text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_stripe_accounts as stripe_account
    where stripe_account.organization_id = p_organization_id
      and stripe_account.stripe_environment = p_stripe_environment
      and stripe_account.onboarding_complete
      and stripe_account.charges_enabled
      and stripe_account.payouts_enabled
      and not stripe_account.account_closed
      and stripe_account.card_payments_status = 'active'
      and stripe_account.payouts_status = 'active'
      and cardinality(stripe_account.requirements_currently_due) = 0
      and cardinality(stripe_account.requirements_past_due) = 0
      and stripe_account.disabled_reason is null
  );
$$;

revoke all on function public.organization_stripe_account_is_ready(bigint, text)
  from public, anon, authenticated;
grant execute on function public.organization_stripe_account_is_ready(bigint, text)
  to authenticated, service_role;

comment on function public.organization_stripe_account_is_ready(bigint, text) is
  'RLS-aware readiness check used before publishing paid events or starting paid checkout.';

-- Payment routing, publication, and paid-ticket activation are server-owned
-- business decisions. Directors retain read access through RLS, while the
-- application performs authorized writes with the service role after checking
-- organization ownership and Stripe readiness.
revoke insert, update, delete on public.orders from authenticated;
revoke insert, update, delete on public.tournaments from authenticated;
revoke insert, update, delete on public.ticket_types from authenticated;
revoke delete on public.organizations from authenticated;

-- Existing orders were created on the TourniBase platform account in Stripe
-- test mode. A null connected-account ID identifies those legacy orders.
alter table public.orders
  add column stripe_connected_account_id text,
  add column stripe_environment text not null default 'test',
  add column platform_fee_amount numeric(10, 2) not null default 0,
  add column platform_fee_refunded numeric(10, 2) not null default 0,
  add column stripe_payment_intent_id text,
  add column stripe_charge_id text,
  add constraint orders_stripe_connected_account_not_blank check (
    stripe_connected_account_id is null
      or char_length(trim(stripe_connected_account_id)) > 0
  ),
  add constraint orders_stripe_environment_valid check (
    stripe_environment in ('test', 'live')
  ),
  add constraint orders_platform_fee_valid check (
    platform_fee_amount >= 0
      and (
        (amount_total = 0 and platform_fee_amount = 0)
        or (amount_total > 0 and platform_fee_amount < amount_total)
      )
  ),
  add constraint orders_platform_fee_refunded_valid check (
    platform_fee_refunded >= 0
      and platform_fee_refunded <= platform_fee_amount
  ),
  add constraint orders_legacy_platform_fee_zero check (
    stripe_connected_account_id is not null
      or platform_fee_amount = 0
  ),
  add constraint orders_stripe_payment_intent_not_blank check (
    stripe_payment_intent_id is null
      or char_length(trim(stripe_payment_intent_id)) > 0
  ),
  add constraint orders_stripe_charge_not_blank check (
    stripe_charge_id is null
      or char_length(trim(stripe_charge_id)) > 0
  );

create index orders_stripe_connected_account_idx
  on public.orders (stripe_connected_account_id)
  where stripe_connected_account_id is not null;
create unique index orders_connected_payment_intent_unique_idx
  on public.orders (stripe_connected_account_id, stripe_payment_intent_id)
  where stripe_connected_account_id is not null
    and stripe_payment_intent_id is not null;
create unique index orders_connected_charge_unique_idx
  on public.orders (stripe_connected_account_id, stripe_charge_id)
  where stripe_connected_account_id is not null
    and stripe_charge_id is not null;

comment on column public.orders.stripe_connected_account_id is
  'Connected account that owns this direct charge. Null means a legacy platform-account order.';
comment on column public.orders.stripe_environment is
  'Immutable Stripe environment used for this order.';
comment on column public.orders.platform_fee_amount is
  'TourniBase application fee charged for this order, stored in dollars.';
comment on column public.orders.platform_fee_refunded is
  'TourniBase application fee returned through Stripe refunds, stored in dollars.';
comment on column public.orders.stripe_payment_intent_id is
  'PaymentIntent identifier within stripe_connected_account_id, when available.';
comment on column public.orders.stripe_charge_id is
  'Charge identifier within stripe_connected_account_id, when available.';

create or replace function private.enforce_order_stripe_snapshot_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    new.stripe_connected_account_id is distinct from old.stripe_connected_account_id
    or new.stripe_environment is distinct from old.stripe_environment
    or new.platform_fee_amount is distinct from old.platform_fee_amount
  ) then
    raise exception 'Stripe routing and application-fee snapshots are immutable.';
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

  return new;
end;
$$;

revoke all on function private.enforce_order_stripe_snapshot_immutability()
  from public, anon, authenticated;

create trigger orders_enforce_stripe_snapshot_immutability
  before update on public.orders
  for each row
  execute function private.enforce_order_stripe_snapshot_immutability();

create or replace function private.enforce_order_stripe_routing_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.stripe_connected_account_id is null then
    if tg_op = 'INSERT' and new.amount_total > 0 then
      raise exception 'New paid orders require a connected Stripe account.';
    end if;

    return new;
  end if;

  if new.amount_total <= 0 then
    raise exception 'Complimentary orders cannot use connected Stripe routing.';
  end if;

  perform 1
  from public.tournaments as tournament
  join public.organization_stripe_accounts as stripe_account
    on stripe_account.organization_id = tournament.organization_id
  where tournament.id = new.tournament_id
    and stripe_account.stripe_account_id = new.stripe_connected_account_id
    and stripe_account.stripe_environment = new.stripe_environment;

  if not found then
    raise exception
      'Order Stripe routing does not belong to the tournament organization.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_order_stripe_routing_integrity()
  from public, anon, authenticated;

create trigger orders_enforce_stripe_routing_integrity
  before insert or update on public.orders
  for each row
  execute function private.enforce_order_stripe_routing_integrity();

-- Resolve payment ownership and reserve ticket inventory in one transaction.
-- Fee configuration is passed by the trusted server, but the database computes
-- the fee only after it has calculated the authoritative cart total.
drop function public.reserve_checkout_order(
  text, text, text, text, text, jsonb
);

create function public.reserve_checkout_order(
  p_event_slug text,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_buyer_team_name text,
  p_items jsonb,
  p_stripe_environment text,
  p_platform_fee_bps integer,
  p_platform_fee_fixed_cents integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_amount_total_cents bigint := 0;
  v_connected_account_id text;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_now timestamptz := clock_timestamp();
  v_order_id bigint;
  v_platform_fee_cents bigint := 0;
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
    or p_stripe_environment not in ('test', 'live')
    or p_platform_fee_bps is null
    or p_platform_fee_bps < 0
    or p_platform_fee_bps > 10000
    or p_platform_fee_fixed_cents is null
    or p_platform_fee_fixed_cents < 0
    or p_platform_fee_fixed_cents > 100000000
  then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Check the buyer information and ticket quantities.'
    );
  end if;

  select
    tournament.id,
    tournament.organization_id,
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

  if v_amount_total_cents > 0 then
    select stripe_account.stripe_account_id
    into v_connected_account_id
    from public.organization_stripe_accounts as stripe_account
    where stripe_account.organization_id = v_tournament.organization_id
      and stripe_account.stripe_environment = p_stripe_environment
      and stripe_account.onboarding_complete
      and stripe_account.charges_enabled
      and stripe_account.payouts_enabled
      and not stripe_account.account_closed
      and stripe_account.card_payments_status = 'active'
      and stripe_account.payouts_status = 'active'
      and cardinality(stripe_account.requirements_currently_due) = 0
      and cardinality(stripe_account.requirements_past_due) = 0
      and stripe_account.disabled_reason is null;

    if not found then
      return jsonb_build_object(
        'status', 'payment_setup_required',
        'message',
          'Online checkout is unavailable while the event organizer finishes payment setup.',
        'organization_id', v_tournament.organization_id,
        'stripe_environment', p_stripe_environment,
        'stripe_account_ready', false
      );
    end if;

    v_platform_fee_cents :=
      round(
        (v_amount_total_cents::numeric * p_platform_fee_bps::numeric)
          / 10000
      )::bigint
      + p_platform_fee_fixed_cents;

    if v_platform_fee_cents < 0
      or v_platform_fee_cents >= v_amount_total_cents
    then
      raise exception 'Invalid TourniBase platform fee configuration.';
    end if;
  else
    v_connected_account_id := null;
    v_platform_fee_cents := 0;
  end if;

  insert into public.orders (
    tournament_id,
    buyer_name,
    buyer_email,
    buyer_phone,
    buyer_team_name,
    amount_total,
    payment_status,
    inventory_expires_at,
    stripe_connected_account_id,
    stripe_environment,
    platform_fee_amount,
    platform_fee_refunded
  )
  values (
    v_tournament.id,
    trim(p_buyer_name),
    lower(trim(p_buyer_email)),
    nullif(trim(coalesce(p_buyer_phone, '')), ''),
    nullif(trim(coalesce(p_buyer_team_name, '')), ''),
    (v_amount_total_cents / 100.0)::numeric(10, 2),
    'pending',
    v_now + interval '31 minutes',
    v_connected_account_id,
    p_stripe_environment,
    (v_platform_fee_cents / 100.0)::numeric(10, 2),
    0
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
    'organization_id', v_tournament.organization_id,
    'tournament_name', v_tournament.name,
    'public_slug', v_tournament.public_slug,
    'amount_total_cents', v_amount_total_cents,
    'inventory_expires_at', v_now + interval '31 minutes',
    'stripe_connected_account_id', v_connected_account_id,
    'stripe_environment', p_stripe_environment,
    'platform_fee_amount_cents', v_platform_fee_cents,
    'stripe_account_ready', v_connected_account_id is not null,
    'items', v_items
  );
end;
$$;

revoke all on function public.reserve_checkout_order(
  text, text, text, text, text, jsonb, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.reserve_checkout_order(
  text, text, text, text, text, jsonb, text, integer, integer
) to service_role;

-- Published events with an active paid ticket are returned to draft until
-- their organization completes a test-mode connected account. Free-only
-- published events remain available.
update public.tournaments as tournament
set status = 'draft'
where tournament.status = 'published'
  and exists (
    select 1
    from public.ticket_types as ticket_type
    where ticket_type.tournament_id = tournament.id
      and ticket_type.status = 'active'
      and ticket_type.price > 0
  )
  and not public.organization_stripe_account_is_ready(
    tournament.organization_id,
    'test'
  );

-- Preserve the existing dashboard response while adding Connect-aware gross
-- sales, refunds, TourniBase fees, and estimated director proceeds.
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
      customer_order.amount_total,
      customer_order.amount_refunded,
      greatest(
        customer_order.amount_total - customer_order.amount_refunded,
        0::numeric
      )::numeric(12, 2) as net_amount,
      customer_order.platform_fee_amount,
      customer_order.platform_fee_refunded,
      customer_order.created_at
    from public.orders as customer_order
    where customer_order.tournament_id = p_tournament_id
      and customer_order.payment_status in ('paid', 'partial_refund', 'refunded')
      and exists (select 1 from authorized_tournament)
  ),
  connect_financial_totals as (
    select
      count(*) filter (
        where captured_order.amount_total > 0
      )::integer as stripe_order_count,
      coalesce(sum(captured_order.amount_total), 0::numeric)
        as captured_revenue,
      coalesce(sum(captured_order.amount_refunded), 0::numeric)
        as refunded_revenue,
      coalesce(sum(captured_order.net_amount), 0::numeric)
        as net_revenue,
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
        connect_financial_totals.captured_revenue * 0.029
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
        connect_financial_totals.net_revenue
          - round(
              connect_financial_totals.captured_revenue * 0.029
                + connect_financial_totals.stripe_order_count * 0.30,
              2
            )
          - connect_financial_totals.retained_platform_fees,
      'estimatedNetPayout',
        connect_financial_totals.net_revenue
          - round(
              connect_financial_totals.captured_revenue * 0.029
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

revoke all on function public.get_tournament_dashboard_metrics(bigint)
  from public, anon, authenticated;
grant execute on function public.get_tournament_dashboard_metrics(bigint)
  to authenticated;
