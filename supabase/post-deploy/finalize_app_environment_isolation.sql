-- POST-DEPLOY CONTRACT TEMPLATE — DO NOT RUN WITH THE ADDITIVE MIGRATION.
--
-- Apply this only after the same environment-aware application build is
-- deployed successfully to both staging and production. Before applying it,
-- copy this reviewed file into a newly timestamped supabase/migrations file so
-- Supabase records it in migration history.

begin;

-- New writes must always state their environment explicitly after rollout.
alter table public.organizations
  alter column operating_environment drop default;

alter table public.orders
  alter column stripe_environment drop default;

comment on column public.organizations.operating_environment is
  'Immutable TourniBase application environment: test for staging or live for production. Every insert must set this explicitly.';

-- Public buyer pages now use the server-side environment-aware data layer.
-- Remove the old anonymous Data API path and the authenticated "published"
-- branches that could expose the other environment's events.
drop policy if exists tournaments_public_select on public.tournaments;
drop policy if exists ticket_types_public_select on public.ticket_types;
drop policy if exists tournaments_authenticated_select on public.tournaments;
drop policy if exists ticket_types_authenticated_select on public.ticket_types;

create policy tournaments_authenticated_select
  on public.tournaments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organizations as organization
      where organization.id = tournaments.organization_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

create policy ticket_types_authenticated_select
  on public.ticket_types
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = ticket_types.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

revoke select on table public.tournaments from anon;
revoke select on table public.ticket_types from anon;

-- Organization creation is a trusted server operation. Keeping the old
-- browser insert/update grants would let a client choose its own environment.
drop policy if exists organizations_director_insert on public.organizations;
drop policy if exists organizations_director_update on public.organizations;
drop policy if exists organizations_director_delete on public.organizations;

revoke insert, update, delete on table public.organizations from authenticated;
revoke usage, select on sequence public.organizations_id_seq from authenticated;

-- The additive migration leaves the original environment-unaware RPC
-- overloads in place so the old build keeps working during rollout. The new
-- overloads become trusted wrappers here, and direct execution of every old
-- overload is removed.
alter function public.reserve_checkout_order(
  text, text, text, text, text, jsonb, text, integer, integer, text
) security definer;
alter function public.get_tournament_dashboard_metrics(bigint, text)
  security definer;
alter function public.validate_pass_for_entry(text, uuid, text, text, text)
  security definer;
alter function public.override_duplicate_pass_entry(
  text, bigint, text, text, text, text
) security definer;
alter function public.undo_pass_check_in(text, bigint, text)
  security definer;
alter function public.lookup_gate_orders(text, text, text)
  security definer;
alter function public.get_recent_scans(text, integer, text)
  security definer;
alter function public.record_gate_sale(
  text, bigint, integer, text, text, text, text
) security definer;

revoke all on function public.reserve_checkout_order(
  text, text, text, text, text, jsonb, text, integer, integer
) from public, anon, authenticated, service_role;
revoke all on function public.get_tournament_dashboard_metrics(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.get_director_lifetime_revenue()
  from public, anon, authenticated, service_role;
revoke all on function public.get_director_lifetime_tickets_sold()
  from public, anon, authenticated, service_role;
revoke all on function public.validate_pass_for_entry(text, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.override_duplicate_pass_entry(
  text, bigint, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.undo_pass_check_in(text, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.lookup_gate_orders(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_recent_scans(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.record_gate_sale(
  text, bigint, integer, text, text, text
) from public, anon, authenticated, service_role;

-- Retain only the environment-aware entry points used by the deployed app.
revoke all on function public.reserve_checkout_order(
  text, text, text, text, text, jsonb, text, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.reserve_checkout_order(
  text, text, text, text, text, jsonb, text, integer, integer, text
) to service_role;

revoke all on function public.get_tournament_dashboard_metrics(bigint, text)
  from public, anon, authenticated;
grant execute on function public.get_tournament_dashboard_metrics(bigint, text)
  to authenticated;

revoke all on function public.get_director_lifetime_revenue(text)
  from public, anon, authenticated;
grant execute on function public.get_director_lifetime_revenue(text)
  to authenticated;

revoke all on function public.get_director_lifetime_tickets_sold(text)
  from public, anon, authenticated;
grant execute on function public.get_director_lifetime_tickets_sold(text)
  to authenticated;

revoke all on function public.validate_pass_for_entry(
  text, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.validate_pass_for_entry(
  text, uuid, text, text, text
) to service_role;

revoke all on function public.override_duplicate_pass_entry(
  text, bigint, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.override_duplicate_pass_entry(
  text, bigint, text, text, text, text
) to service_role;

revoke all on function public.undo_pass_check_in(text, bigint, text)
  from public, anon, authenticated;
grant execute on function public.undo_pass_check_in(text, bigint, text)
  to service_role;

revoke all on function public.lookup_gate_orders(text, text, text)
  from public, anon, authenticated;
grant execute on function public.lookup_gate_orders(text, text, text)
  to service_role;

revoke all on function public.get_recent_scans(text, integer, text)
  from public, anon, authenticated;
grant execute on function public.get_recent_scans(text, integer, text)
  to service_role;

revoke all on function public.record_gate_sale(
  text, bigint, integer, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.record_gate_sale(
  text, bigint, integer, text, text, text, text
) to service_role;

-- The wrappers are security-definer functions after this contract, so callers
-- no longer need direct access to the private environment helper.
revoke execute on function private.scanner_matches_app_environment(text, text)
  from service_role;
revoke usage on schema private from service_role;

commit;
