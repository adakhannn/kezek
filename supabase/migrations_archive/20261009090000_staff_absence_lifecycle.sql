begin;

alter table public.staff_time_off
  add column created_by uuid,
  add column cancelled_at timestamptz,
  add column cancelled_by uuid;

create index staff_time_off_active_staff_dates_idx
  on public.staff_time_off(staff_id, date_from, date_to)
  where cancelled_at is null;

-- Existing rows remain active. Cancellation keeps the original range for audit.
create or replace function public.schedule_effective_day(p_staff uuid, p_day date)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
    st record; v record; legacy record; regular_day boolean := false; result jsonb; business_tz text;
begin
    select s.*, coalesce(b.tz,'Asia/Bishkek') as business_tz into st
    from public.staff s join public.businesses b on b.id=s.biz_id where s.id=p_staff;
    if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
    business_tz := st.business_tz;
    result := jsonb_build_object('date',p_day,'branch_id',st.branch_id,'tz',business_tz,
        'source','unconfigured','intervals','[]'::jsonb,'breaks','[]'::jsonb);
    if not st.is_active then return result; end if;
    if exists(select 1 from public.staff_time_off t where t.staff_id=p_staff and t.biz_id=st.biz_id
              and t.cancelled_at is null and p_day between t.date_from and t.date_to) then
        return result || jsonb_build_object('source','absence');
    end if;
    select * into v from public.staff_schedule_versions where staff_id=p_staff
        and kind='day' and effective_from=p_day order by revision desc limit 1;
    regular_day := found and coalesce(v.days->'day'->>'use_regular','false')='true';
    if found and not regular_day then
        return public.schedule_bound_to_branch(result || (v.days->'day') || jsonb_build_object('branch_id',v.branch_id,'source','day'),st.biz_id,p_day);
    end if;
    if not regular_day and exists(select 1 from public.staff_schedule_rules r where r.staff_id=p_staff and r.is_active
        and ((r.kind='date' and r.date_on=p_day) or (r.kind='range' and p_day between r.date_from and r.date_to))) then
        select * into legacy from public.resolve_staff_day_legacy(p_staff,p_day);
        if found then
            return result || to_jsonb(legacy) || jsonb_build_object('source','legacy');
        end if;
    end if;
    select * into v from public.staff_schedule_versions where staff_id=p_staff
        and kind='week' and effective_from<=p_day order by effective_from desc,revision desc limit 1;
    if found then
        return public.schedule_bound_to_branch(result || (v.days->extract(isodow from p_day)::int::text)
            || jsonb_build_object('branch_id',v.branch_id,'source','week'),st.biz_id,p_day);
    end if;
    select * into legacy from public.resolve_staff_day_legacy(p_staff,p_day);
    if found then
        if not exists(select 1 from public.staff_schedule_rules r where r.staff_id=p_staff and r.is_active
            and r.kind='weekly' and r.day_of_week=extract(dow from p_day)::int)
            and exists(select 1 from public.staff_home_branch_changes c where c.staff_id=p_staff) then
            legacy.branch_id := coalesce(
                (select c.to_branch_id from public.staff_home_branch_changes c where c.staff_id=p_staff and c.effective_on<=p_day order by c.effective_on desc,c.id desc limit 1),
                (select c.from_branch_id from public.staff_home_branch_changes c where c.staff_id=p_staff order by c.effective_on,c.id limit 1));
        end if;
        return result || to_jsonb(legacy) || jsonb_build_object('source','legacy');
    end if;
    return result;
end;
$$;

-- The fallback resolver also checks absences. Keep its behaviour aligned with
-- schedule_effective_day after a soft cancellation.
create or replace function public.resolve_staff_day_legacy(p_staff_id uuid, p_date date)
returns table(branch_id uuid, tz text, intervals jsonb, breaks jsonb)
language plpgsql as $function$
declare
  v_row record; v_sched_found boolean := false; v_biz uuid; v_branch uuid; v_tz text;
  v_intervals jsonb := '[]'::jsonb; v_breaks jsonb := '[]'::jsonb; dow int := extract(dow from p_date);
begin
  if exists (select 1 from public.staff_time_off t where t.staff_id=p_staff_id
    and t.cancelled_at is null and p_date between t.date_from and t.date_to) then return; end if;
  select st.biz_id,b.tz into v_biz,v_tz from public.staff st join public.businesses b on b.id=st.biz_id where st.id=p_staff_id;
  if v_biz is null then return; end if;
  for v_row in select * from public.staff_schedule_rules r where r.staff_id=p_staff_id and r.is_active
    and ((r.kind='date' and r.date_on=p_date) or (r.kind='range' and p_date between r.date_from and r.date_to)
      or (r.kind='weekly' and r.day_of_week=dow))
    order by case r.kind when 'date' then 3 when 'range' then 2 else 1 end desc,r.priority desc,r.created_at desc loop
    branch_id:=v_row.branch_id; tz:=coalesce(v_row.tz,v_tz,'Asia/Bishkek');
    intervals:=coalesce(v_row.intervals,'[]'::jsonb); breaks:=coalesce(v_row.breaks,'[]'::jsonb);
    v_sched_found:=true; return next; return;
  end loop;
  if not v_sched_found then
    select st.branch_id into v_branch from public.staff st where st.id=p_staff_id;
    if v_branch is null then return; end if;
    select wh.intervals,wh.breaks into v_intervals,v_breaks from public.working_hours wh
      where wh.staff_id=p_staff_id and wh.day_of_week=dow and wh.biz_id=v_biz limit 1;
    if v_intervals is null then return; end if;
    branch_id:=v_branch; tz:=coalesce(v_tz,'Asia/Bishkek'); intervals:=v_intervals;
    breaks:=coalesce(v_breaks,'[]'::jsonb); return next; return;
  end if;
  return;
end
$function$;

create or replace function public.guard_staff_absence_booking() returns trigger
language plpgsql security definer set search_path=public as $$
declare business_tz text;
begin
 if tg_op='UPDATE' then
   if old.cancelled_at is not null or new.cancelled_at is null or new.cancelled_by is null
      or (to_jsonb(new) - 'cancelled_at' - 'cancelled_by') is distinct from
         (to_jsonb(old) - 'cancelled_at' - 'cancelled_by') then
     raise exception 'SCHEDULE_INVALID';
   end if;
 else
   if new.cancelled_at is not null or new.cancelled_by is not null then raise exception 'SCHEDULE_INVALID'; end if;
 end if;
 perform 1 from public.staff where id=new.staff_id and biz_id=new.biz_id for update;
 if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
 if tg_op='UPDATE' then return new; end if;
 if new.date_from is null or new.date_to is null or new.date_to<new.date_from then raise exception 'SCHEDULE_INVALID'; end if;
 if exists(select 1 from public.staff_time_off t where t.staff_id=new.staff_id and t.biz_id=new.biz_id
   and t.cancelled_at is null and t.date_from<=new.date_to and t.date_to>=new.date_from) then
   raise exception 'SCHEDULE_ABSENCE_OVERLAP';
 end if;
 select coalesce(tz,'Asia/Bishkek') into business_tz from public.businesses where id=new.biz_id;
 if exists(select 1 from public.bookings b where b.staff_id=new.staff_id and b.biz_id=new.biz_id
   and (b.status::text in ('confirmed','paid') or (b.status::text='hold' and b.expires_at>now()))
   and b.end_at>now() and b.start_at<((new.date_to+1)::timestamp at time zone business_tz)
   and b.end_at>(new.date_from::timestamp at time zone business_tz)) then
   raise exception 'SCHEDULE_BOOKING_CONFLICT';
 end if;
 return new;
end $$;

-- All writes must pass through the manager-only server endpoint. Reads retain existing RLS.
revoke insert, update, delete on public.staff_time_off from public, anon, authenticated;

insert into supabase_migrations.schema_migrations(version, name)
values ('20261009090000', 'staff_absence_lifecycle')
on conflict (version) do nothing;

commit;
