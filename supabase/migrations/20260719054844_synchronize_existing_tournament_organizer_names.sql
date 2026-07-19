update public.tournaments as tournament
set organizer_name = director.name
from public.organizations as organization
join public.users as director
  on director.id = organization.owner_user_id
where tournament.organization_id = organization.id
  and director.role = 'director'
  and tournament.organizer_name is distinct from director.name;
