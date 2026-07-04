-- The local demo seed uses the server-only service role. Grant only the
-- application-table operations that seed-demo.mjs performs.

grant select, insert, update
  on public.users
  to service_role;

grant select, insert
  on public.organizations
  to service_role;

grant select, insert, update
  on public.tournaments, public.ticket_types
  to service_role;

grant usage, select
  on sequence
    public.organizations_id_seq,
    public.tournaments_id_seq,
    public.ticket_types_id_seq
  to service_role;
