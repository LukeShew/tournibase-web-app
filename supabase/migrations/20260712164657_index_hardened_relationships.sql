-- Cover the composite relationship constraints added by the pilot hardening
-- migration. These indexes keep deletes and relationship checks predictable as
-- order and scan volume grows.
create index check_ins_pass_tournament_idx
  on public.check_ins (pass_id, tournament_id);
create index check_ins_scanner_tournament_idx
  on public.check_ins (scanner_session_id, tournament_id);
create index manual_sales_scanner_tournament_idx
  on public.manual_sales (scanner_session_id, tournament_id);
create index manual_sales_ticket_tournament_idx
  on public.manual_sales (ticket_type_id, tournament_id);
create index order_items_order_tournament_idx
  on public.order_items (order_id, tournament_id);
create index order_items_ticket_tournament_idx
  on public.order_items (ticket_type_id, tournament_id);
create index passes_order_item_relationship_idx
  on public.passes (order_item_id, order_id, ticket_type_id, tournament_id);
create index passes_order_tournament_idx
  on public.passes (order_id, tournament_id);
create index passes_ticket_tournament_idx
  on public.passes (ticket_type_id, tournament_id);
