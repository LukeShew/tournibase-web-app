-- Local Supabase uses stricter service_role defaults than the hosted project.
-- Grant only the table operations required by server routes, RPC functions,
-- and the guarded local demo seed.

grant select, insert
  on
    public.users,
    public.organizations,
    public.tournaments,
    public.ticket_types,
    public.orders,
    public.order_items,
    public.passes,
    public.scanner_sessions,
    public.check_ins,
    public.manual_sales
  to service_role;

grant update
  on
    public.users,
    public.tournaments,
    public.ticket_types,
    public.orders,
    public.passes,
    public.scanner_sessions,
    public.check_ins
  to service_role;

grant usage, select
  on sequence
    public.organizations_id_seq,
    public.tournaments_id_seq,
    public.ticket_types_id_seq,
    public.orders_id_seq,
    public.order_items_id_seq,
    public.passes_id_seq,
    public.scanner_sessions_id_seq,
    public.check_ins_id_seq,
    public.manual_sales_id_seq
  to service_role;

-- Demo records are created separately by `npm run seed`. That command refuses
-- non-local Supabase hostnames, so this SQL file never contains demo accounts,
-- tournaments, tickets, orders, or passes.
