create or replace function public.get_director_lifetime_tickets_sold()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(
      (
        select count(*)
        from public.passes as admission_pass
        join public.orders as customer_order
          on customer_order.id = admission_pass.order_id
        join public.tournaments as tournament
          on tournament.id = admission_pass.tournament_id
        join public.organizations as organization
          on organization.id = tournament.organization_id
        where organization.owner_user_id = (select auth.uid())
          and customer_order.payment_status in ('paid', 'partial_refund')
          and admission_pass.status in ('active', 'checked_in')
      ),
      0::bigint
    )
    + coalesce(
      (
        select sum(manual_sale.quantity)
        from public.manual_sales as manual_sale
        join public.tournaments as tournament
          on tournament.id = manual_sale.tournament_id
        join public.organizations as organization
          on organization.id = tournament.organization_id
        where organization.owner_user_id = (select auth.uid())
      ),
      0::bigint
    );
$$;

revoke all on function public.get_director_lifetime_tickets_sold()
  from public, anon;
grant execute on function public.get_director_lifetime_tickets_sold()
  to authenticated;

comment on function public.get_director_lifetime_tickets_sold() is
  'Returns the signed-in director''s active paid passes plus manually recorded admissions across every event.';
