-- One active date rule per staff member and day (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md
-- FE-02). resolve_staff_day_legacy uses one active kind='date' rule per day, but nothing stopped a
-- second one: two managers or two tabs opening the legacy schedule editor both inserted the
-- missing days, and the readers that expect one row (.maybeSingle() in shift opening, today's
-- shift and finance) then failed and silently fell back to working_hours. The editor no longer
-- writes on view; this partial unique index makes a second active rule for the same staff member
-- and date impossible (23505, shown to the manager as "already saved by another user").
-- Production had no duplicates on 18 Nov 2026. A database that has them must resolve them first:
-- guard_legacy_staff_schedule_write refuses any change for staff on published schedules, so the
-- migration does not pick a winner itself.
begin;

do $$
declare
    v_duplicates integer;
begin
    select count(*) into v_duplicates
      from (select 1
              from public.staff_schedule_rules
             where kind = 'date' and is_active
             group by staff_id, date_on
            having count(*) > 1) duplicates;
    if v_duplicates > 0 then
        raise exception 'FE-02: % staff/date pair(s) have several active date rules; deactivate the extra rows first',
            v_duplicates;
    end if;
end $$;

create unique index if not exists staff_schedule_rules_one_active_date
    on public.staff_schedule_rules (staff_id, date_on)
    where kind = 'date' and is_active;

commit;
