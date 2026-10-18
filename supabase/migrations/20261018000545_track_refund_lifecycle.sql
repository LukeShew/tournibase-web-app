-- Hosted migration version: 20261018000545 (applied October 17 US Eastern).
-- Additive lifecycle fields: only the service-role reconciliation writes orders.
-- A failed refund is not money returned. Keep the original platform-fee refund
-- irreversible, but allow an authoritative CAS-versioned buyer-refund correction.
alter table public.orders
  add column refund_pending_amount numeric(10,2) not null default 0 check (refund_pending_amount >= 0),
  add column refund_failed_amount numeric(10,2) not null default 0 check (refund_failed_amount >= 0),
  add column refund_sync_version bigint not null default 0 check (refund_sync_version >= 0);

comment on column public.orders.refund_pending_amount is
  'Current pending/requires_action Stripe refunds; excluded from completed refund totals.';
comment on column public.orders.refund_failed_amount is
  'Historical failed/canceled Stripe refund attempts requiring director review; not refunded money.';
comment on column public.orders.refund_sync_version is
  'Optimistic concurrency version; read before Stripe and increment atomically for each authoritative snapshot.';

create or replace function private.enforce_order_stripe_snapshot_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_initial_buyer_fee_addition boolean;
begin
  -- reserve_checkout_order_with_buyer_fee first calls the existing atomic
  -- inventory reservation with a zero application fee, then fills the fee
  -- snapshot before this transaction commits. No existing order is repriced.
  v_initial_buyer_fee_addition :=
    old.created_at = transaction_timestamp()
    and old.payment_status = 'pending'
    and new.payment_status = 'pending'
    and old.stripe_checkout_id is null
    and old.stripe_payment_intent_id is null
    and old.stripe_charge_id is null
    and new.stripe_checkout_id is null
    and new.stripe_payment_intent_id is null
    and new.stripe_charge_id is null
    and old.amount_refunded = 0
    and new.amount_refunded = 0
    and old.platform_fee_amount = 0
    and old.buyer_fee_amount = 0
    and new.buyer_fee_amount > 0
    and new.platform_fee_amount = new.buyer_fee_amount
    and new.amount_total = old.amount_total + new.buyer_fee_amount
    and old.amount_total > 0;

  if new.stripe_connected_account_id is distinct from old.stripe_connected_account_id
    or new.stripe_environment is distinct from old.stripe_environment
    or (
      (new.platform_fee_amount is distinct from old.platform_fee_amount
        or new.buyer_fee_amount is distinct from old.buyer_fee_amount)
      and not v_initial_buyer_fee_addition
    )
    or (
      old.buyer_fee_amount > 0
      and new.amount_total is distinct from old.amount_total
    )
  then
    raise exception 'Stripe routing and fee snapshots are immutable.';
  end if;

  if old.stripe_payment_intent_id is not null
    and new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
  then
    raise exception 'The Stripe PaymentIntent snapshot cannot be changed once recorded.';
  end if;

  if old.stripe_charge_id is not null
    and new.stripe_charge_id is distinct from old.stripe_charge_id
  then
    raise exception 'The Stripe charge snapshot cannot be changed once recorded.';
  end if;

  if new.platform_fee_refunded < old.platform_fee_refunded then
    raise exception 'The refunded TourniBase fee cannot decrease.';
  end if;
  if (new.buyer_fee_refunded < old.buyer_fee_refunded
      or new.amount_refunded < old.amount_refunded)
    and new.refund_sync_version <> old.refund_sync_version + 1 then
    raise exception 'Refund corrections require a fresh synchronization version.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_order_stripe_snapshot_immutability()
  from public, anon, authenticated;
