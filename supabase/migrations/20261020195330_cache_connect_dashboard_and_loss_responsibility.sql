-- Additive cache only: no account replacement and no inferred historical values.
alter table public.organization_stripe_accounts
  add column dashboard text check (dashboard in ('express', 'full', 'none')),
  add column losses_collector text check (losses_collector in ('stripe', 'application'));

comment on column public.organization_stripe_accounts.dashboard is
  'Most recently retrieved Accounts v2 dashboard. NULL means not yet verified.';
comment on column public.organization_stripe_accounts.losses_collector is
  'Most recently retrieved Accounts v2 loss responsibility. NULL fails closed for director-free readiness.';
