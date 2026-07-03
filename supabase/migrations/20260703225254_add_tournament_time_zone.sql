-- Keep admission dates anchored to the tournament location, not the viewer's device.

alter table public.tournaments
  add column time_zone text not null default 'America/New_York',
  add constraint tournaments_time_zone_not_blank check (
    char_length(trim(time_zone)) > 0
    and char_length(time_zone) <= 100
  );

-- Existing ticket dates were entered as calendar dates and stored at UTC
-- boundaries. Re-anchor those calendar dates to each tournament's time zone.
update public.ticket_types as ticket_type
set
  valid_from = (
    (ticket_type.valid_from at time zone 'UTC')::date::timestamp
    at time zone tournament.time_zone
  ),
  valid_until = (
    (
      (ticket_type.valid_until at time zone 'UTC')::date
      + time '23:59:59.999'
    )
    at time zone tournament.time_zone
  )
from public.tournaments as tournament
where tournament.id = ticket_type.tournament_id;

update public.order_items as order_item
set
  valid_from = (
    (order_item.valid_from at time zone 'UTC')::date::timestamp
    at time zone tournament.time_zone
  ),
  valid_until = (
    (
      (order_item.valid_until at time zone 'UTC')::date
      + time '23:59:59.999'
    )
    at time zone tournament.time_zone
  )
from public.orders as customer_order
join public.tournaments as tournament
  on tournament.id = customer_order.tournament_id
where customer_order.id = order_item.order_id;

update public.passes as candidate_pass
set
  valid_from = (
    (candidate_pass.valid_from at time zone 'UTC')::date::timestamp
    at time zone tournament.time_zone
  ),
  valid_until = (
    (
      (candidate_pass.valid_until at time zone 'UTC')::date
      + time '23:59:59.999'
    )
    at time zone tournament.time_zone
  )
from public.tournaments as tournament
where tournament.id = candidate_pass.tournament_id;
