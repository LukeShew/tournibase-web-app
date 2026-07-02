-- TourniBase web-first MVP foundation.
-- All application tables use RLS and explicit Data API grants.

create type public.user_role as enum ('director');
create type public.tournament_status as enum ('draft', 'published', 'closed', 'archived');
create type public.ticket_type_status as enum ('active', 'inactive', 'sold_out');
create type public.order_payment_status as enum (
  'pending',
  'paid',
  'failed',
  'refunded',
  'partial_refund'
);
create type public.pass_status as enum ('active', 'checked_in', 'refunded', 'voided', 'expired');
create type public.check_in_result as enum (
  'valid',
  'already_used',
  'wrong_day',
  'invalid',
  'refunded',
  'voided',
  'manual_check_in',
  'override'
);
create type public.manual_sale_payment_method as enum (
  'cash',
  'venmo',
  'card_outside_tournibase',
  'comp'
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role public.user_role not null default 'director',
  created_at timestamptz not null default now(),
  constraint users_name_not_blank check (char_length(trim(name)) > 0),
  constraint users_email_not_blank check (char_length(trim(email)) > 0)
);

create unique index users_email_unique_idx on public.users (lower(email));

create table public.organizations (
  id bigint generated always as identity primary key,
  name text not null,
  owner_user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (char_length(trim(name)) > 0)
);

create index organizations_owner_user_id_idx on public.organizations (owner_user_id);

create table public.tournaments (
  id bigint generated always as identity primary key,
  organization_id bigint not null references public.organizations (id) on delete cascade,
  name text not null,
  sport text not null default 'youth_basketball',
  start_date date not null,
  end_date date not null,
  venue_name text not null,
  venue_address text,
  organizer_name text not null,
  contact_email text not null,
  description text,
  status public.tournament_status not null default 'draft',
  public_slug text not null unique,
  created_at timestamptz not null default now(),
  constraint tournaments_name_not_blank check (char_length(trim(name)) > 0),
  constraint tournaments_sport_is_youth_basketball check (sport = 'youth_basketball'),
  constraint tournaments_dates_valid check (end_date >= start_date),
  constraint tournaments_venue_name_not_blank check (char_length(trim(venue_name)) > 0),
  constraint tournaments_organizer_name_not_blank check (char_length(trim(organizer_name)) > 0),
  constraint tournaments_contact_email_not_blank check (char_length(trim(contact_email)) > 0),
  constraint tournaments_public_slug_format check (
    public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

create index tournaments_organization_created_at_idx
  on public.tournaments (organization_id, created_at desc);
create index tournaments_public_status_dates_idx
  on public.tournaments (status, start_date, end_date)
  where status = 'published';

create table public.ticket_types (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments (id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  description text,
  quantity_limit integer,
  status public.ticket_type_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint ticket_types_name_not_blank check (char_length(trim(name)) > 0),
  constraint ticket_types_price_nonnegative check (price >= 0),
  constraint ticket_types_validity_valid check (valid_until >= valid_from),
  constraint ticket_types_quantity_limit_positive check (
    quantity_limit is null or quantity_limit > 0
  )
);

create index ticket_types_tournament_status_idx
  on public.ticket_types (tournament_id, status);

create table public.orders (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments (id) on delete restrict,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  buyer_team_name text,
  stripe_checkout_id text unique,
  amount_total numeric(10, 2) not null,
  payment_status public.order_payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint orders_buyer_name_not_blank check (char_length(trim(buyer_name)) > 0),
  constraint orders_buyer_email_not_blank check (char_length(trim(buyer_email)) > 0),
  constraint orders_amount_total_nonnegative check (amount_total >= 0)
);

create index orders_tournament_created_at_idx
  on public.orders (tournament_id, created_at desc);
create index orders_tournament_payment_status_idx
  on public.orders (tournament_id, payment_status);

create table public.passes (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete restrict,
  tournament_id bigint not null references public.tournaments (id) on delete restrict,
  ticket_type_id bigint not null references public.ticket_types (id) on delete restrict,
  public_token uuid not null default gen_random_uuid() unique,
  status public.pass_status not null default 'active',
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  uses_allowed integer not null default 1,
  created_at timestamptz not null default now(),
  constraint passes_validity_valid check (valid_until >= valid_from),
  constraint passes_uses_allowed_positive check (uses_allowed > 0)
);

create index passes_order_id_idx on public.passes (order_id);
create index passes_tournament_status_idx on public.passes (tournament_id, status);
create index passes_ticket_type_id_idx on public.passes (ticket_type_id);

create table public.scanner_sessions (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments (id) on delete cascade,
  gate_name text not null,
  token_hash text not null unique,
  permissions text[] not null default array['scan']::text[],
  expires_at timestamptz not null,
  staff_label text not null,
  created_by uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  last_active_at timestamptz,
  constraint scanner_sessions_gate_name_not_blank check (char_length(trim(gate_name)) > 0),
  constraint scanner_sessions_token_hash_not_blank check (char_length(trim(token_hash)) > 0),
  constraint scanner_sessions_staff_label_not_blank check (char_length(trim(staff_label)) > 0),
  constraint scanner_sessions_permissions_valid check (
    permissions <@ array['scan', 'lookup', 'recent', 'manual_sale']::text[]
    and cardinality(permissions) > 0
  )
);

create index scanner_sessions_tournament_expires_at_idx
  on public.scanner_sessions (tournament_id, expires_at);
create index scanner_sessions_created_by_idx on public.scanner_sessions (created_by);

create table public.check_ins (
  id bigint generated always as identity primary key,
  pass_id bigint not null references public.passes (id) on delete restrict,
  tournament_id bigint not null references public.tournaments (id) on delete restrict,
  scanner_session_id bigint not null references public.scanner_sessions (id) on delete restrict,
  gate_name text not null,
  result public.check_in_result not null,
  override_reason text,
  created_at timestamptz not null default now(),
  constraint check_ins_gate_name_not_blank check (char_length(trim(gate_name)) > 0),
  constraint check_ins_override_reason_present check (
    result <> 'override'
    or (override_reason is not null and char_length(trim(override_reason)) > 0)
  )
);

create index check_ins_pass_created_at_idx
  on public.check_ins (pass_id, created_at desc);
create index check_ins_tournament_created_at_idx
  on public.check_ins (tournament_id, created_at desc);
create index check_ins_scanner_session_id_idx on public.check_ins (scanner_session_id);

create table public.manual_sales (
  id bigint generated always as identity primary key,
  tournament_id bigint not null references public.tournaments (id) on delete restrict,
  scanner_session_id bigint not null references public.scanner_sessions (id) on delete restrict,
  ticket_type_id bigint not null references public.ticket_types (id) on delete restrict,
  quantity integer not null,
  payment_method public.manual_sale_payment_method not null,
  amount numeric(10, 2) not null,
  buyer_name text,
  notes text,
  created_at timestamptz not null default now(),
  constraint manual_sales_quantity_positive check (quantity > 0),
  constraint manual_sales_amount_nonnegative check (amount >= 0)
);

create index manual_sales_tournament_created_at_idx
  on public.manual_sales (tournament_id, created_at desc);
create index manual_sales_scanner_session_id_idx
  on public.manual_sales (scanner_session_id);
create index manual_sales_ticket_type_id_idx on public.manual_sales (ticket_type_id);

alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.tournaments enable row level security;
alter table public.ticket_types enable row level security;
alter table public.orders enable row level security;
alter table public.passes enable row level security;
alter table public.scanner_sessions enable row level security;
alter table public.check_ins enable row level security;
alter table public.manual_sales enable row level security;

create policy users_select_own
  on public.users
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy users_update_own_name
  on public.users
  for update
  to authenticated
  using ((select auth.uid()) = id and role = 'director')
  with check ((select auth.uid()) = id and role = 'director');

create policy organizations_director_select
  on public.organizations
  for select
  to authenticated
  using (
    owner_user_id = (select auth.uid())
    and exists (
      select 1
      from public.users as app_user
      where app_user.id = (select auth.uid())
        and app_user.role = 'director'
    )
  );

create policy organizations_director_insert
  on public.organizations
  for insert
  to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and exists (
      select 1
      from public.users as app_user
      where app_user.id = (select auth.uid())
        and app_user.role = 'director'
    )
  );

create policy organizations_director_update
  on public.organizations
  for update
  to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy organizations_director_delete
  on public.organizations
  for delete
  to authenticated
  using (owner_user_id = (select auth.uid()));

create policy tournaments_public_select
  on public.tournaments
  for select
  to anon
  using (status = 'published');

create policy tournaments_authenticated_select
  on public.tournaments
  for select
  to authenticated
  using (
    status = 'published'
    or exists (
      select 1
      from public.organizations as organization
      where organization.id = tournaments.organization_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

create policy tournaments_director_insert
  on public.tournaments
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.organizations as organization
      where organization.id = tournaments.organization_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

create policy tournaments_director_update
  on public.tournaments
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.organizations as organization
      where organization.id = tournaments.organization_id
        and organization.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.organizations as organization
      where organization.id = tournaments.organization_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

create policy tournaments_director_delete
  on public.tournaments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.organizations as organization
      where organization.id = tournaments.organization_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

create policy ticket_types_public_select
  on public.ticket_types
  for select
  to anon
  using (
    status = 'active'
    and exists (
      select 1
      from public.tournaments as tournament
      where tournament.id = ticket_types.tournament_id
        and tournament.status = 'published'
    )
  );

create policy ticket_types_authenticated_select
  on public.ticket_types
  for select
  to authenticated
  using (
    (
      status = 'active'
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

create policy ticket_types_director_insert
  on public.ticket_types
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = ticket_types.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

create policy ticket_types_director_update
  on public.ticket_types
  for update
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
  )
  with check (
    exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = ticket_types.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

create policy ticket_types_director_delete
  on public.ticket_types
  for delete
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

create policy orders_director_all
  on public.orders
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = orders.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = orders.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

create policy passes_director_all
  on public.passes
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = passes.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = passes.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

create policy scanner_sessions_director_all
  on public.scanner_sessions
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = scanner_sessions.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  )
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = scanner_sessions.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

create policy check_ins_director_all
  on public.check_ins
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = check_ins.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = check_ins.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

create policy manual_sales_director_all
  on public.manual_sales
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = manual_sales.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.tournaments as tournament
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where tournament.id = manual_sales.tournament_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.users to authenticated;
grant update (name) on public.users to authenticated;

grant select, insert, update, delete
  on public.organizations,
     public.tournaments,
     public.ticket_types,
     public.orders,
     public.passes,
     public.scanner_sessions,
     public.check_ins,
     public.manual_sales
  to authenticated;

grant select on public.tournaments, public.ticket_types to anon;

grant usage, select
  on sequence public.organizations_id_seq,
              public.tournaments_id_seq,
              public.ticket_types_id_seq,
              public.orders_id_seq,
              public.passes_id_seq,
              public.scanner_sessions_id_seq,
              public.check_ins_id_seq,
              public.manual_sales_id_seq
  to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, 'director'), '@', 1)
    ),
    coalesce(new.email, new.id::text || '@pending.local')
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created_or_email_changed
  after insert or update of email on auth.users
  for each row
  execute function private.handle_new_auth_user();
