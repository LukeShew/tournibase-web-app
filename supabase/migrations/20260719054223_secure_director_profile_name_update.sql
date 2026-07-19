create or replace function public.update_director_profile_name(
  p_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := trim(p_name);
begin
  if v_user_id is null then
    raise exception 'Sign in before updating the director name.';
  end if;

  if v_name is null
    or char_length(v_name) < 2
    or char_length(v_name) > 120
  then
    raise exception 'Director name must be between 2 and 120 characters.';
  end if;

  update public.users as app_user
  set name = v_name
  where app_user.id = v_user_id
    and app_user.role = 'director';

  if not found then
    raise exception 'Director profile not found.';
  end if;

  update public.tournaments as tournament
  set organizer_name = v_name
  where exists (
    select 1
    from public.organizations as organization
    where organization.id = tournament.organization_id
      and organization.owner_user_id = v_user_id
  );
end;
$$;

revoke all on function public.update_director_profile_name(text)
  from public, anon;
grant execute on function public.update_director_profile_name(text)
  to authenticated;

comment on function public.update_director_profile_name(text) is
  'Updates the signed-in director profile name and keeps organizer names consistent across every tournament they own.';
