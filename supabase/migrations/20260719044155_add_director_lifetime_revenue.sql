create or replace function public.get_director_lifetime_revenue()
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select round(
    coalesce(
      (
        select sum(
          greatest(
            customer_order.amount_total - customer_order.amount_refunded,
            0::numeric
          )
        )
        from public.orders as customer_order
        join public.tournaments as tournament
          on tournament.id = customer_order.tournament_id
        join public.organizations as organization
          on organization.id = tournament.organization_id
        where organization.owner_user_id = (select auth.uid())
          and customer_order.payment_status in (
            'paid',
            'partial_refund',
            'refunded'
          )
      ),
      0::numeric
    )
    + coalesce(
      (
        select sum(manual_sale.amount)
        from public.manual_sales as manual_sale
        join public.tournaments as tournament
          on tournament.id = manual_sale.tournament_id
        join public.organizations as organization
          on organization.id = tournament.organization_id
        where organization.owner_user_id = (select auth.uid())
      ),
      0::numeric
    ),
    2
  );
$$;

revoke all on function public.get_director_lifetime_revenue()
  from public, anon;
grant execute on function public.get_director_lifetime_revenue()
  to authenticated;

comment on function public.get_director_lifetime_revenue() is
  'Returns the signed-in director''s net paid online admissions plus manual admissions across every event.';
