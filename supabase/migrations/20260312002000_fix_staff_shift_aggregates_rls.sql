-- Fix RLS for staff_shift_aggregates so that close_staff_shift_safe / update_shift_aggregates
-- can insert/update rows both for staff (authenticated) and for manager/service_role flows.

-- 1) Allow authenticated staff to write aggregates for "their" staff_id
drop policy if exists "Staff shift aggregates write own insert" on public.staff_shift_aggregates;
drop policy if exists "Staff shift aggregates write own update" on public.staff_shift_aggregates;

create policy "Staff shift aggregates write own insert"
    on public.staff_shift_aggregates
    for insert
    to authenticated
    with check (
        exists (
            select 1
            from public.staff s
            where s.id = staff_id
              and s.user_id = auth.uid()
              and s.is_active = true
        )
    );

create policy "Staff shift aggregates write own update"
    on public.staff_shift_aggregates
    for update
    to authenticated
    using (
        exists (
            select 1
            from public.staff s
            where s.id = staff_id
              and s.user_id = auth.uid()
              and s.is_active = true
        )
    )
    with check (
        exists (
            select 1
            from public.staff s
            where s.id = staff_id
              and s.user_id = auth.uid()
              and s.is_active = true
        )
    );

-- 2) Allow service_role (менеджерские/cron-функции через service key) свободно писать агрегаты
drop policy if exists "Staff shift aggregates write service_role" on public.staff_shift_aggregates;

create policy "Staff shift aggregates write service_role"
    on public.staff_shift_aggregates
    for all
    to service_role
    using (true)
    with check (true);