-- Organization creation remains a trusted server-only operation. Restore the
-- service-role table and sequence privileges used by the signup flow while
-- keeping browser roles unable to choose an operating environment.
grant insert on table public.organizations to service_role;
grant usage, select on sequence public.organizations_id_seq to service_role;
