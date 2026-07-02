drop index if exists public.passes_order_item_sequence_unique_idx;

alter table public.passes
  add constraint passes_order_item_sequence_unique
  unique (order_item_id, sequence_number);
