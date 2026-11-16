-- Allow business owners to manage staff_shifts for their own staff
-- This is mainly to keep /dashboard/staff/[id]/finance and related owner APIs working
-- even when SUPABASE_SERVICE_ROLE_KEY is not configured (admin client falls back to RLS client).

begin;

-- Safety: ensure the table exists before applying policies
do $$
begin
    if to_regclass('public.staff_shifts') is null then
        raise exception 'Table public.staff_shifts does not exist';
    end if;
end;
$$;

-- Drop previous version of the policy if it exists, then recreate with the desired definition
drop policy if exists "Business owners can manage staff shifts" on public.staff_shifts;

-- Владельцы, админы и менеджеры могут управлять сменами своих сотрудников
create policy "Business owners can manage staff shifts"
    on public.staff_shifts
    for all
    to authenticated
    using (
        exists (
            select 1
            from public.staff s
            join public.user_roles ur on ur.biz_id = s.biz_id
            join public.roles r on ur.role_id = r.id
            where s.id = staff_shifts.staff_id
              and ur.user_id = auth.uid()
              and r.key in ('owner', 'admin', 'manager')
        )
        or is_super_admin()
    )
    with check (
        exists (
            select 1
            from public.staff s
            join public.user_roles ur on ur.biz_id = s.biz_id
            join public.roles r on ur.role_id = r.id
            where s.id = staff_shifts.staff_id
              and ur.user_id = auth.uid()
              and r.key in ('owner', 'admin', 'manager')
        )
        or is_super_admin()
    );

commit;

