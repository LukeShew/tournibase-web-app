-- Track one transactional pass email per online order.
-- Sending remains server-only; directors and public clients cannot access this
-- table or its claim function through the Data API.

create type public.order_email_delivery_status as enum (
  'pending',
  'sending',
  'sent',
  'retryable_failure',
  'permanent_failure'
);

create table public.order_email_deliveries (
  order_id bigint primary key
    references public.orders (id) on delete cascade,
  status public.order_email_delivery_status not null default 'pending',
  provider text,
  provider_message_id text,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  locked_at timestamptz,
  sent_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_email_deliveries_attempt_count_nonnegative check (
    attempt_count >= 0
  ),
  constraint order_email_deliveries_provider_not_blank check (
    provider is null or char_length(trim(provider)) > 0
  ),
  constraint order_email_deliveries_provider_message_id_not_blank check (
    provider_message_id is null
    or char_length(trim(provider_message_id)) > 0
  ),
  constraint order_email_deliveries_last_error_code_not_blank check (
    last_error_code is null or char_length(trim(last_error_code)) > 0
  ),
  constraint order_email_deliveries_last_error_message_not_blank check (
    last_error_message is null
    or char_length(trim(last_error_message)) > 0
  ),
  constraint order_email_deliveries_sent_state_valid check (
    status <> 'sent'
    or (
      sent_at is not null
      and provider is not null
      and provider_message_id is not null
    )
  )
);

create unique index order_email_deliveries_provider_message_unique_idx
  on public.order_email_deliveries (provider, provider_message_id)
  where provider_message_id is not null;

create index order_email_deliveries_retry_queue_idx
  on public.order_email_deliveries (updated_at, order_id)
  where status in ('pending', 'retryable_failure', 'sending');

alter table public.order_email_deliveries enable row level security;

revoke all on public.order_email_deliveries
  from public, anon, authenticated;

grant select, insert, update
  on public.order_email_deliveries
  to service_role;

create or replace function public.claim_order_email_delivery(
  p_order_id bigint
)
returns setof public.order_email_deliveries
language sql
security invoker
set search_path = ''
as $$
  update public.order_email_deliveries as delivery
  set
    status = 'sending',
    attempt_count = delivery.attempt_count + 1,
    last_attempt_at = now(),
    locked_at = now(),
    last_error_code = null,
    last_error_message = null,
    updated_at = now()
  where delivery.order_id = p_order_id
    and (
      delivery.status in ('pending', 'retryable_failure')
      or (
        delivery.status = 'sending'
        and delivery.locked_at < now() - interval '10 minutes'
      )
    )
  returning delivery.*;
$$;

revoke all on function public.claim_order_email_delivery(bigint)
  from public, anon, authenticated;

grant execute on function public.claim_order_email_delivery(bigint)
  to service_role;
