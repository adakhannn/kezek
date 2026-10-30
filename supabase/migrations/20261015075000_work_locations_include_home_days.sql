-- Work locations are an effective-day projection, including home-branch days.
-- Keep the existing signature, three public-safe columns and service-only ACL.
-- Transfer-only consumers must still filter out home-branch rows.
create or replace function public.read_staff_work_locations(p_biz uuid,p_from date,p_to date)
returns table(staff_id uuid,branch_id uuid,date_on date)
language plpgsql stable security definer set search_path = public
as $$
begin
    if p_from is null or p_to is null or p_to<p_from or p_to-p_from>62 then
        raise exception 'SCHEDULE_INVALID';
    end if;
    return query select s.id,(d.value->>'branch_id')::uuid,p_from+i
        from public.staff s cross join generate_series(0,p_to-p_from) i
        cross join lateral (select public.schedule_effective_day(s.id,p_from+i) value) d
        where s.biz_id=p_biz and s.is_active
        and jsonb_array_length(d.value->'intervals')>0;
end;
$$;
