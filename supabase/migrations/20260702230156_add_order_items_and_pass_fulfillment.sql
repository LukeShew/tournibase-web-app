-- Preserve the exact ticket selections used to create a Stripe Checkout Session.
-- This lets webhook fulfillment create one idempotent pass per purchased unit.

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  ticket_type_id bigint not null references public.ticket_types (id) on delete restrict,
  ticket_name text not null,
  unit_amount_cents integer not null,
  quantity integer not null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  created_at timestamptz not null default now(),
  constraint order_items_ticket_name_not_blank check (
    char_length(trim(ticket_name)) > 0
  ),
  constraint order_items_unit_amount_nonnegative check (
    unit_amount_cents >= 0
  ),
  constraint order_items_quantity_valid check (
    quantity between 1 and 10
  ),
  constraint order_items_validity_valid check (
    valid_until >= valid_from
  )
);

create index order_items_order_id_idx
  on public.order_items (order_id);
create index order_items_ticket_type_id_idx
  on public.order_items (ticket_type_id);

alter table public.passes
  add column order_item_id bigint
    references public.order_items (id) on delete restrict,
  add column sequence_number integer,
  add constraint passes_order_item_fields_together check (
    (order_item_id is null and sequence_number is null)
    or (order_item_id is not null and sequence_number is not null)
  ),
  add constraint passes_sequence_number_positive check (
    sequence_number is null or sequence_number > 0
  );

create unique index passes_order_item_sequence_unique_idx
  on public.passes (order_item_id, sequence_number)
  where order_item_id is not null;

alter table public.order_items enable row level security;

create policy order_items_director_select
  on public.order_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.orders as customer_order
      join public.tournaments as tournament
        on tournament.id = customer_order.tournament_id
      join public.organizations as organization
        on organization.id = tournament.organization_id
      where customer_order.id = order_items.order_id
        and organization.owner_user_id = (select auth.uid())
    )
  );

revoke all on public.order_items from anon, authenticated;
revoke all on sequence public.order_items_id_seq from anon, authenticated;

grant select on public.order_items to authenticated;

grant select, insert, update, delete
  on public.order_items
  to service_role;

grant usage, select
  on sequence public.order_items_id_seq
  to service_role;
