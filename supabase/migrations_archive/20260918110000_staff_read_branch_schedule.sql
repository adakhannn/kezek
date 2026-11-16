drop policy if exists "Staff can view their home branch working hours" on public.branch_working_hours;
create policy "Staff can view their home branch working hours"
    on public.branch_working_hours for select to authenticated
    using (exists (
        select 1 from public.staff st
        where st.user_id = auth.uid() and st.is_active
          and st.biz_id = branch_working_hours.biz_id
          and st.branch_id = branch_working_hours.branch_id
    ));

insert into supabase_migrations.schema_migrations(version, name)
values ('20260918110000', 'staff_read_branch_schedule')
on conflict (version) do nothing;
