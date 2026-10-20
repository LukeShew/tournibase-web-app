-- Admin-only Sandbox transition. Never rewrites an order's Stripe snapshot,
-- disables a trigger, changes a live connection, or marks an unverified account ready.
create table private.sandbox_stripe_account_transitions (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations(id),
  old_stripe_account_id text not null unique,
  new_stripe_account_id text not null,
  old_connection jsonb not null,
  reason text not null check (length(trim(reason)) > 0),
  transitioned_at timestamptz not null default now()
);
alter table private.sandbox_stripe_account_transitions enable row level security;
revoke all on private.sandbox_stripe_account_transitions from public, anon, authenticated, service_role;
revoke all on sequence private.sandbox_stripe_account_transitions_id_seq from public, anon, authenticated, service_role;

create function private.transition_sandbox_stripe_account(
  p_organization_id bigint, p_expected_owner uuid,
  p_expected_old_account text, p_new_account text, p_reason text
) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  v_old public.organization_stripe_accounts%rowtype;
  v_new_id bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(20261020, 1);
  if p_expected_owner is null or p_expected_old_account is null
    or p_new_account is null or p_new_account !~ '^acct_[A-Za-z0-9]+$'
    or p_new_account = p_expected_old_account
    or p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A distinct account, expected owner and audit reason are required.';
  end if;
  perform 1 from public.organizations where id=p_organization_id
    and owner_user_id=p_expected_owner and operating_environment='test' for update;
  if not found then raise exception 'Expected Sandbox organization and owner not found.'; end if;
  select * into v_old from public.organization_stripe_accounts
    where organization_id=p_organization_id and stripe_environment='test'
      and stripe_account_id=p_expected_old_account for update;
  if not found then raise exception 'Expected previous Sandbox connection not found.'; end if;
  if exists(select 1 from public.organization_stripe_accounts where stripe_account_id=p_new_account)
    or exists(select 1 from private.sandbox_stripe_account_transitions
      where old_stripe_account_id=p_new_account or new_stripe_account_id=p_new_account)
    or exists(select 1 from public.orders where stripe_connected_account_id=p_new_account) then
    raise exception 'Replacement must be a separate, unused connected account.';
  end if;
  insert into private.sandbox_stripe_account_transitions
    (organization_id,old_stripe_account_id,new_stripe_account_id,old_connection,reason)
    values(p_organization_id,v_old.stripe_account_id,p_new_account,to_jsonb(v_old),p_reason);
  -- Archive and replace the current-connection record atomically. Its UPDATE
  -- immutability guard remains in place. Historical orders are never changed.
  delete from public.organization_stripe_accounts where id=v_old.id;
  insert into public.organization_stripe_accounts
    (organization_id,stripe_account_id,stripe_environment)
    values(p_organization_id,p_new_account,'test') returning id into v_new_id;
  -- Capability flags default to false until an authenticated fresh Stripe sync.
  return v_new_id;
end;
$$;
revoke all on function private.transition_sandbox_stripe_account(bigint,uuid,text,text,text)
  from public, anon, authenticated, service_role;

create or replace function private.enforce_order_stripe_routing_integrity()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_organization_environment text;
begin
  select organization.operating_environment into v_organization_environment
  from public.tournaments tournament join public.organizations organization
    on organization.id=tournament.organization_id where tournament.id=new.tournament_id;
  if not found then raise exception 'Order tournament organization was not found.'; end if;
  if new.stripe_environment <> v_organization_environment then
    raise exception 'Order environment does not match the tournament organization.';
  end if;
  if new.stripe_connected_account_id is null then
    if tg_op='INSERT' and new.amount_total>0 then
      raise exception 'New paid orders require a connected Stripe account.';
    end if;
    return new;
  end if;
  if new.amount_total<=0 then raise exception 'Complimentary orders cannot use connected Stripe routing.'; end if;
  -- Already validated order snapshots remain valid after a connection change.
  -- Other triggers still prohibit changing routing, environment, or tournament.
  if tg_op='UPDATE' then
    if new.stripe_connected_account_id=old.stripe_connected_account_id
      and new.stripe_environment=old.stripe_environment
      and new.tournament_id=old.tournament_id then return new; end if;
  end if;
  perform 1 from public.tournaments tournament
    join public.organization_stripe_accounts stripe_account on stripe_account.organization_id=tournament.organization_id
    where tournament.id=new.tournament_id
      and stripe_account.stripe_account_id=new.stripe_connected_account_id
      and stripe_account.stripe_environment=new.stripe_environment;
  if not found then raise exception 'Order Stripe routing does not belong to the tournament organization.'; end if;
  return new;
end;
$$;
revoke all on function private.enforce_order_stripe_routing_integrity() from public,anon,authenticated;
