-- Add an application environment boundary while production and staging share
-- one Supabase project. The schema change is additive so the environment-aware
-- build can be deployed before the later contract migration. Apply this file
-- in a short maintenance window with signup and checkout paused; the old build
-- must not create new organizations or payments after classification begins.

begin;

-- Hold the audited classification stable for the duration of the migration.
-- Run this migration during the documented signup and checkout maintenance
-- window so these locks are acquired immediately.
lock table public.organizations,
  public.organization_stripe_accounts,
  public.tournaments,
  public.orders,
  public.users,
  auth.users
in share row exclusive mode;

-- Refuse to guess when the hosted data no longer matches the audited rollout
-- state. A clean database with no organizations is valid for local resets.
do $$
declare
  v_expected_organization_count bigint;
  v_organization_count bigint;
begin
  select count(*)
  into v_organization_count
  from public.organizations;

  if v_organization_count = 0 then
    return;
  end if;

  select count(*)
  into v_expected_organization_count
  from public.organizations as organization
  join public.users as app_user
    on app_user.id = organization.owner_user_id
  join auth.users as auth_user
    on auth_user.id = organization.owner_user_id
  join public.organization_stripe_accounts as stripe_account
    on stripe_account.organization_id = organization.id
  where organization.name = 'Luke Events'
    and lower(app_user.email) = 'lsautomates@gmail.com'
    and lower(auth_user.email) = 'lsautomates@gmail.com'
    and stripe_account.stripe_account_id = 'acct_1Tui4qBDCykX1MuY'
    and stripe_account.stripe_environment = 'test';

  if v_organization_count <> 1 or v_expected_organization_count <> 1 then
    raise exception
      'Environment migration stopped: organization data no longer matches the audited rollout state.';
  end if;

  if (select count(*) from public.users) <> 1
    or (select count(*) from auth.users) <> 1
    or not exists (
      select 1
      from public.users as app_user
      join auth.users as auth_user
        on auth_user.id = app_user.id
      join public.organizations as organization
        on organization.owner_user_id = app_user.id
      where organization.name = 'Luke Events'
        and lower(app_user.email) = 'lsautomates@gmail.com'
        and lower(auth_user.email) = 'lsautomates@gmail.com'
    )
  then
    raise exception
      'Environment migration stopped: an existing Auth or director account is not included in the audited test workspace.';
  end if;

  if (
    select count(*)
    from public.organization_stripe_accounts as stripe_account
  ) <> 1
    or not exists (
      select 1
      from public.organization_stripe_accounts as stripe_account
      join public.organizations as organization
        on organization.id = stripe_account.organization_id
      join public.users as app_user
        on app_user.id = organization.owner_user_id
      where organization.name = 'Luke Events'
        and lower(app_user.email) = 'lsautomates@gmail.com'
        and stripe_account.stripe_account_id = 'acct_1Tui4qBDCykX1MuY'
        and stripe_account.stripe_environment = 'test'
    )
  then
    raise exception
      'Environment migration stopped: the audited Stripe Sandbox account was not found.';
  end if;

  if exists (
    select 1
    from public.orders as customer_order
    join public.tournaments as tournament
      on tournament.id = customer_order.tournament_id
    join public.organizations as organization
      on organization.id = tournament.organization_id
    join public.users as app_user
      on app_user.id = organization.owner_user_id
    where organization.name = 'Luke Events'
      and lower(app_user.email) = 'lsautomates@gmail.com'
      and customer_order.stripe_environment <> 'test'
  ) then
    raise exception
      'Environment migration stopped: the existing test organization has a non-test order.';
  end if;
end;
$$;

alter table public.organizations
  add column operating_environment text not null default 'live',
  add constraint organizations_operating_environment_valid check (
    operating_environment in ('test', 'live')
  );

-- The one audited organization and all of its existing data remain in the
-- permanent test environment. The temporary live default exists only for
-- deploy-order compatibility. The environment-aware application always sets
-- this value explicitly, and the contract migration removes the default.
update public.organizations as organization
set operating_environment = 'test'
from public.users as app_user,
  public.organization_stripe_accounts as stripe_account
where app_user.id = organization.owner_user_id
  and stripe_account.organization_id = organization.id
  and organization.name = 'Luke Events'
  and lower(app_user.email) = 'lsautomates@gmail.com'
  and stripe_account.stripe_account_id = 'acct_1Tui4qBDCykX1MuY'
  and stripe_account.stripe_environment = 'test';

comment on column public.organizations.operating_environment is
  'Immutable TourniBase application environment: test for staging or live for production. The rollout default is temporary.';

-- Organization setup has always been performed by the trusted server. Remove
-- the unused browser mutation path immediately so a client cannot choose its
-- own operating environment during the additive-to-contract rollout window.
drop policy if exists organizations_director_insert on public.organizations;
drop policy if exists organizations_director_update on public.organizations;
drop policy if exists organizations_director_delete on public.organizations;

revoke insert, update, delete on table public.organizations from authenticated;
revoke usage, select on sequence public.organizations_id_seq from authenticated;

alter table public.organizations
  add constraint organizations_owner_user_unique unique (owner_user_id),
  add constraint organizations_id_environment_unique
    unique (id, operating_environment);

-- An organization can only reference a connected account from its own
-- application environment. The original single-column foreign key remains in
-- place during the additive rollout.
alter table public.organization_stripe_accounts
  add constraint organization_stripe_accounts_org_environment_fk
  foreign key (organization_id, stripe_environment)
  references public.organizations (id, operating_environment)
  on delete cascade
  not valid;

alter table public.organization_stripe_accounts
  validate constraint organization_stripe_accounts_org_environment_fk;

create or replace function private.enforce_organization_routing_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id
    or new.operating_environment is distinct from old.operating_environment
  then
    raise exception 'Organization ownership and environment are immutable.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_organization_routing_immutability()
  from public, anon, authenticated;

create trigger organizations_enforce_routing_immutability
  before update on public.organizations
  for each row
  execute function private.enforce_organization_routing_immutability();

create or replace function private.enforce_tournament_organization_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'A tournament cannot be moved to another organization.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_tournament_organization_immutability()
  from public, anon, authenticated;

create trigger tournaments_enforce_organization_immutability
  before update on public.tournaments
  for each row
  execute function private.enforce_tournament_organization_immutability();

create or replace function private.enforce_connected_account_routing_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.stripe_environment is distinct from old.stripe_environment
    or new.stripe_account_id is distinct from old.stripe_account_id
  then
    raise exception 'Connected-account organization, environment, and Stripe account are immutable.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_connected_account_routing_immutability()
  from public, anon, authenticated;

create trigger organization_stripe_accounts_enforce_routing_immutability
  before update on public.organization_stripe_accounts
  for each row
  execute function private.enforce_connected_account_routing_immutability();

create or replace function private.enforce_order_tournament_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.tournament_id is distinct from old.tournament_id then
    raise exception 'An order cannot be moved to another tournament.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_order_tournament_immutability()
  from public, anon, authenticated;

create trigger orders_enforce_tournament_immutability
  before update on public.orders
  for each row
  execute function private.enforce_order_tournament_immutability();

-- Paid and complimentary orders both inherit the tournament organization's
-- environment. Legacy paid platform orders may still be updated, but no new
-- paid order can omit connected-account routing.
create or replace function private.enforce_order_stripe_routing_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_organization_environment text;
begin
  select organization.operating_environment
  into v_organization_environment
  from public.tournaments as tournament
  join public.organizations as organization
    on organization.id = tournament.organization_id
  where tournament.id = new.tournament_id;

  if not found then
    raise exception 'Order tournament organization was not found.';
  end if;

  if new.stripe_environment <> v_organization_environment then
    raise exception 'Order environment does not match the tournament organization.';
  end if;

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

-- Helper used by the environment-aware scanner RPC overloads below. The
-- service role remains the only caller of scanner RPCs.
create or replace function private.scanner_matches_app_environment(
  p_scanner_token_hash text,
  p_app_environment text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(p_app_environment in ('test', 'live'), false)
    and exists (
      select 1
      from public.scanner_sessions as scanner_session
      join public.tournaments as tournament
        on tournament.id = scanner_session.tournament_id
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where scanner_session.token_hash = p_scanner_token_hash
        and organization.operating_environment = p_app_environment
    );
$$;

revoke all on function private.scanner_matches_app_environment(text, text)
  from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.scanner_matches_app_environment(text, text)
  to service_role;

-- Checkout already snapshots the Stripe environment. The extra application
-- environment argument prevents a staging endpoint from reserving inventory
-- for a live event (and vice versa) before the original atomic RPC runs.
create function public.reserve_checkout_order(
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
begin
  if p_app_environment not in ('test', 'live')
    or p_stripe_environment is distinct from p_app_environment
  then
    return jsonb_build_object(
      'status', 'invalid_request',
      'message', 'Check the payment environment configuration.'
    );
  end if;

  if not exists (
    select 1
    from public.tournaments as tournament
    join public.organizations as organization
      on organization.id = tournament.organization_id
    where tournament.public_slug = p_event_slug
      and organization.operating_environment = p_app_environment
  ) then
    return jsonb_build_object(
      'status', 'event_unavailable',
      'message', 'This event is not currently accepting online orders.'
    );
  end if;

  return public.reserve_checkout_order(
    p_event_slug,
    p_buyer_name,
    p_buyer_email,
    p_buyer_phone,
    p_buyer_team_name,
    p_items,
    p_stripe_environment,
    p_platform_fee_bps,
    p_platform_fee_fixed_cents
  );
end;
$$;

revoke all on function public.reserve_checkout_order(
  text, text, text, text, text, jsonb, text, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.reserve_checkout_order(
  text, text, text, text, text, jsonb, text, integer, integer, text
) to service_role;

-- Dashboard RPC overloads preserve the original signatures for the additive
-- rollout while the new application always supplies p_app_environment.
create function public.get_tournament_dashboard_metrics(
  p_tournament_id bigint,
  p_app_environment text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_app_environment not in ('test', 'live')
    or not exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = p_tournament_id
        and organization.owner_user_id = (select auth.uid())
        and organization.operating_environment = p_app_environment
    )
  then
    return null;
  end if;

  return public.get_tournament_dashboard_metrics(p_tournament_id);
end;
$$;

revoke all on function public.get_tournament_dashboard_metrics(bigint, text)
  from public, anon, authenticated;
grant execute on function public.get_tournament_dashboard_metrics(bigint, text)
  to authenticated;

create function public.get_director_lifetime_revenue(
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
              customer_order.amount_total - customer_order.amount_refunded,
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

revoke all on function public.get_director_lifetime_revenue(text)
  from public, anon, authenticated;
grant execute on function public.get_director_lifetime_revenue(text)
  to authenticated;

create function public.get_director_lifetime_tickets_sold(
  p_app_environment text
)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_app_environment not in ('test', 'live') then 0::bigint
    else
      coalesce(
        (
          select count(*)
          from public.passes as admission_pass
          join public.orders as customer_order
            on customer_order.id = admission_pass.order_id
          join public.tournaments as tournament
            on tournament.id = admission_pass.tournament_id
          join public.organizations as organization
            on organization.id = tournament.organization_id
          where organization.owner_user_id = (select auth.uid())
            and organization.operating_environment = p_app_environment
            and customer_order.stripe_environment = p_app_environment
            and customer_order.payment_status in ('paid', 'partial_refund')
            and admission_pass.status in ('active', 'checked_in')
        ),
        0::bigint
      )
      + coalesce(
        (
          select sum(manual_sale.quantity)
          from public.manual_sales as manual_sale
          join public.tournaments as tournament
            on tournament.id = manual_sale.tournament_id
          join public.organizations as organization
            on organization.id = tournament.organization_id
          where organization.owner_user_id = (select auth.uid())
            and organization.operating_environment = p_app_environment
        ),
        0::bigint
      )
  end;
$$;

revoke all on function public.get_director_lifetime_tickets_sold(text)
  from public, anon, authenticated;
grant execute on function public.get_director_lifetime_tickets_sold(text)
  to authenticated;

create function public.validate_pass_for_entry(
  p_scanner_token_hash text,
  p_pass_token uuid,
  p_attempted_token_hash text,
  p_source text,
  p_app_environment text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.scanner_matches_app_environment(
    p_scanner_token_hash,
    p_app_environment
  ) is not true then
    return jsonb_build_object(
      'status', 'scanner_unauthorized',
      'message', 'This scanner link is no longer authorized.'
    );
  end if;

  return public.validate_pass_for_entry(
    p_scanner_token_hash,
    p_pass_token,
    p_attempted_token_hash,
    p_source
  );
end;
$$;

revoke all on function public.validate_pass_for_entry(
  text, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.validate_pass_for_entry(
  text, uuid, text, text, text
) to service_role;

create function public.override_duplicate_pass_entry(
  p_scanner_token_hash text,
  p_pass_id bigint,
  p_attempted_token_hash text,
  p_source text,
  p_reason text,
  p_app_environment text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.scanner_matches_app_environment(
    p_scanner_token_hash,
    p_app_environment
  ) is not true then
    return jsonb_build_object(
      'status', 'scanner_unauthorized',
      'message', 'This scanner link is no longer authorized.'
    );
  end if;

  return public.override_duplicate_pass_entry(
    p_scanner_token_hash,
    p_pass_id,
    p_attempted_token_hash,
    p_source,
    p_reason
  );
end;
$$;

revoke all on function public.override_duplicate_pass_entry(
  text, bigint, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.override_duplicate_pass_entry(
  text, bigint, text, text, text, text
) to service_role;

create function public.undo_pass_check_in(
  p_scanner_token_hash text,
  p_check_in_id bigint,
  p_app_environment text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.scanner_matches_app_environment(
    p_scanner_token_hash,
    p_app_environment
  ) is not true then
    return jsonb_build_object(
      'status', 'scanner_unauthorized',
      'message', 'This scanner link is no longer authorized.'
    );
  end if;

  return public.undo_pass_check_in(p_scanner_token_hash, p_check_in_id);
end;
$$;

revoke all on function public.undo_pass_check_in(text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.undo_pass_check_in(text, bigint, text)
  to service_role;

create function public.lookup_gate_orders(
  p_scanner_token_hash text,
  p_query text,
  p_app_environment text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.scanner_matches_app_environment(
    p_scanner_token_hash,
    p_app_environment
  ) is not true then
    return jsonb_build_object(
      'status', 'scanner_unauthorized',
      'message', 'This scanner link is not authorized for manual lookup.'
    );
  end if;

  return public.lookup_gate_orders(p_scanner_token_hash, p_query);
end;
$$;

revoke all on function public.lookup_gate_orders(text, text, text)
  from public, anon, authenticated;
grant execute on function public.lookup_gate_orders(text, text, text)
  to service_role;

create function public.get_recent_scans(
  p_scanner_token_hash text,
  p_limit integer,
  p_app_environment text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.scanner_matches_app_environment(
    p_scanner_token_hash,
    p_app_environment
  ) is not true then
    return jsonb_build_object(
      'status', 'scanner_unauthorized',
      'message', 'This scanner link is not authorized to view recent scans.'
    );
  end if;

  return public.get_recent_scans(p_scanner_token_hash, p_limit);
end;
$$;

revoke all on function public.get_recent_scans(text, integer, text)
  from public, anon, authenticated;
grant execute on function public.get_recent_scans(text, integer, text)
  to service_role;

create function public.record_gate_sale(
  p_scanner_token_hash text,
  p_ticket_type_id bigint,
  p_quantity integer,
  p_payment_method text,
  p_buyer_name text,
  p_notes text,
  p_app_environment text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.scanner_matches_app_environment(
    p_scanner_token_hash,
    p_app_environment
  ) is not true then
    return jsonb_build_object(
      'status', 'scanner_unauthorized',
      'message', 'This scanner link is not authorized to record gate sales.'
    );
  end if;

  return public.record_gate_sale(
    p_scanner_token_hash,
    p_ticket_type_id,
    p_quantity,
    p_payment_method,
    p_buyer_name,
    p_notes
  );
end;
$$;

revoke all on function public.record_gate_sale(
  text, bigint, integer, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_gate_sale(
  text, bigint, integer, text, text, text, text
) to service_role;

comment on constraint organizations_owner_user_unique
  on public.organizations is
  'One TourniBase director account owns exactly one organization during the pilot.';

comment on constraint organizations_id_environment_unique
  on public.organizations is
  'Supports composite environment foreign keys without changing globally unique tournament slugs.';

commit;
