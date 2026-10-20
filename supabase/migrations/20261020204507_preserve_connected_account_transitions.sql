-- ADDITIVE PRE-DEPLOY: old and new app builds remain compatible. No connection switch.
alter table public.organization_stripe_accounts
  add column is_current boolean not null default true;
comment on column public.organization_stripe_accounts.is_current is
  'Only the current account accepts new orders. Retired records remain for historical payments and refunds.';

-- Keep existing reviewed function bodies and privileges, adding only the
-- current-connection predicate. Fail closed if the expected source has drifted.
do $$
declare signature text; definition text; needle text := 'and stripe_account.onboarding_complete';
begin
  foreach signature in array array[
    'public.organization_stripe_account_is_ready(bigint,text)',
    'public.reserve_checkout_order(text,text,text,text,text,jsonb,text,integer,integer)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 then
      raise exception 'Unexpected current-account query shape: %', signature;
    end if;
    execute replace(definition,needle,'and stripe_account.is_current ' || needle);
  end loop;
  definition := pg_get_functiondef('private.enforce_order_stripe_routing_integrity()'::regprocedure);
  needle := 'and stripe_account.stripe_environment = new.stripe_environment;';
  if (length(definition)-length(replace(definition,needle,'')))/length(needle) <> 1 then
    raise exception 'Unexpected order-integrity query shape';
  end if;
  execute replace(definition,needle,
    'and stripe_account.stripe_environment = new.stripe_environment and (TG_OP = ''UPDATE'' or stripe_account.is_current);');
end;
$$;
