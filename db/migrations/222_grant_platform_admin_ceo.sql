-- Grant platform super_admin to ceo@cortavia.com if user exists
insert into public.platform_admins (user_id)
select u.id
from public.users u
where lower(coalesce(u.primary_email, '')) = lower('ceo@cortavia.com')
on conflict (user_id) do nothing;


