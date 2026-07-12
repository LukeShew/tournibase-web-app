drop index if exists public.passes_order_item_relationship_idx;
create index passes_order_item_relationship_idx
  on public.passes (order_item_id, order_id, tournament_id, ticket_type_id);
