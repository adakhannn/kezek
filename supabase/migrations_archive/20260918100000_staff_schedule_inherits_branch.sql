-- Staff schedule inheritance
-- New staff do not receive a copied two-week calendar. The resolver falls back
-- to the selected branch weekly template; date/range/weekly staff rules remain
-- explicit exceptions and temporary transfers.

create or replace function public.resolve_staff_day(p_staff_id uuid, p_date date)
returns table(branch_id uuid, tz text, intervals jsonb, breaks jsonb)
language plpgsql
security definer
set search_path = public
as $function$
declare
    v_row record;
    v_biz uuid;
    v_branch uuid;
    v_tz text;
    v_intervals jsonb;
    v_breaks jsonb;
    v_dow int := extract(dow from p_date);
begin
    if exists (
        select 1 from public.staff_time_off t
        where t.staff_id = p_staff_id and p_date between t.date_from and t.date_to
    ) then
        return;
    end if;

    select st.biz_id, st.branch_id, b.tz
      into v_biz, v_branch, v_tz
      from public.staff st
      join public.businesses b on b.id = st.biz_id
     where st.id = p_staff_id;
    if v_biz is null or v_branch is null then return; end if;

    -- Explicit staff rules always win: date, range, then weekly.
    for v_row in
        select * from public.staff_schedule_rules r
         where r.staff_id = p_staff_id and r.is_active
           and ((r.kind = 'date' and r.date_on = p_date)
             or (r.kind = 'range' and p_date between r.date_from and r.date_to)
             or (r.kind = 'weekly' and r.day_of_week = v_dow))
         order by case r.kind when 'date' then 3 when 'range' then 2 else 1 end desc,
                  r.priority desc, r.created_at desc
    loop
        return query select v_row.branch_id,
            coalesce(v_row.tz, v_tz, 'Asia/Bishkek'),
            coalesce(v_row.intervals, '[]'::jsonb),
            coalesce(v_row.breaks, '[]'::jsonb);
        return;
    end loop;

    -- Legacy per-staff weekly rules remain supported during migration.
    select wh.intervals, wh.breaks
      into v_intervals, v_breaks
      from public.working_hours wh
     where wh.staff_id = p_staff_id and wh.day_of_week = v_dow and wh.biz_id = v_biz
     limit 1;
    if v_intervals is not null then
        return query select v_branch, coalesce(v_tz, 'Asia/Bishkek'),
            v_intervals, coalesce(v_breaks, '[]'::jsonb);
        return;
    end if;

    -- Canonical default: inherit the branch weekly template. Missing/empty
    -- intervals are a day off; never invent 09:00-21:00.
    select wh.intervals, wh.breaks
      into v_intervals, v_breaks
      from public.branch_working_hours wh
     where wh.biz_id = v_biz and wh.branch_id = v_branch and wh.day_of_week = v_dow
     limit 1;
    if v_intervals is null then return; end if;

    return query select v_branch, coalesce(v_tz, 'Asia/Bishkek'),
        coalesce(v_intervals, '[]'::jsonb), coalesce(v_breaks, '[]'::jsonb);
end;
$function$;

comment on function public.resolve_staff_day(uuid, date) is
'Resolves explicit staff exceptions first, then legacy weekly rules, then the staff home branch template.';

insert into supabase_migrations.schema_migrations(version, name)
values ('20260918100000', 'staff_schedule_inherits_branch')
on conflict (version) do nothing;
