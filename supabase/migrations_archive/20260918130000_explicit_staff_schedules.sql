-- Additive rollout. No legacy rules are deleted, rewritten or automatically classified.
-- Application rollout flag: SCHEDULE_V2_ENABLED. Apply only after isolated verification.
begin;

create table public.staff_home_branch_changes (
    id bigint generated always as identity primary key,
    staff_id uuid not null references public.staff(id),
    biz_id uuid not null references public.businesses(id),
    from_branch_id uuid references public.branches(id),
    to_branch_id uuid not null references public.branches(id),
    effective_on date not null,
    transaction_id bigint not null default txid_current(),
    created_by uuid not null,
    created_at timestamptz not null default now()
);
create index staff_home_branch_changes_lookup on public.staff_home_branch_changes(staff_id,effective_on desc,id desc);
alter table public.staff_home_branch_changes enable row level security;
revoke all on public.staff_home_branch_changes from public,anon,authenticated,service_role;
grant select on public.staff_home_branch_changes to service_role;

create table public.staff_schedule_versions (
    id uuid primary key default gen_random_uuid(),
    staff_id uuid not null references public.staff(id),
    biz_id uuid not null references public.businesses(id),
    branch_id uuid not null references public.branches(id),
    kind text not null check (kind in ('week', 'day')),
    effective_from date not null,
    days jsonb not null,
    revision bigint not null check (revision > 0),
    created_by uuid not null,
    created_at timestamptz not null default now(),
    unique(staff_id, revision)
);
create index staff_schedule_versions_lookup on public.staff_schedule_versions(staff_id, kind, effective_from desc, revision desc);
alter table public.staff_schedule_versions enable row level security;
-- Immutable versions; only service-role commands may write. No browser table access.
revoke all on public.staff_schedule_versions from anon, authenticated, service_role;
grant select, insert on public.staff_schedule_versions to service_role;

-- Preserve the exact deployed resolver rather than reconstructing legacy behaviour.
alter function public.resolve_staff_day(uuid, date) rename to resolve_staff_day_legacy;
revoke all on function public.resolve_staff_day_legacy(uuid, date) from public, anon, authenticated;

create function public.schedule_actor_can_manage(p_actor uuid, p_biz uuid)
returns boolean language sql stable security definer set search_path = public
as $$
    select p_actor is not null and (
        exists(select 1 from public.businesses where id=p_biz and owner_id=p_actor)
        or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
                  where ur.user_id=p_actor and (r.key='super_admin' or (ur.biz_id=p_biz and r.key in ('owner','admin','manager'))))
    );
$$;
revoke all on function public.schedule_actor_can_manage(uuid, uuid) from public, anon, authenticated;

-- Branch hours are an availability boundary for newly published plans, not a
-- source of invented staff hours. Existing legacy days retain their old meaning.
create function public.schedule_bound_to_branch(p_day jsonb,p_biz uuid,p_date date)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare hours record; effective jsonb; pauses jsonb;
begin
    select wh.* into hours from public.branch_working_hours wh
        join public.branches b on b.id=wh.branch_id and b.is_active
        where wh.biz_id=p_biz and wh.branch_id=(p_day->>'branch_id')::uuid
        and wh.day_of_week=extract(dow from p_date)::int;
    if not found then return p_day || jsonb_build_object('intervals','[]'::jsonb,'breaks','[]'::jsonb); end if;
    select coalesce(jsonb_agg(jsonb_build_object('start',a,'end',z) order by a),'[]'::jsonb) into effective from (
        select greatest(s->>'start',b->>'start') a,least(s->>'end',b->>'end') z
        from jsonb_array_elements(p_day->'intervals') s cross join jsonb_array_elements(hours.intervals) b
        where greatest(s->>'start',b->>'start')<least(s->>'end',b->>'end')
    ) ranges;
    pauses:=coalesce(p_day->'breaks','[]'::jsonb)||coalesce(hours.breaks,'[]'::jsonb);
    return p_day || jsonb_build_object('intervals',effective,'breaks',pauses);
end;
$$;
revoke all on function public.schedule_bound_to_branch(jsonb,uuid,date) from public, anon, authenticated;

-- Internal, authoritative day resolution. Legacy dates remain explicit exceptions.
create function public.schedule_effective_day(p_staff uuid, p_day date)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
    st record; v record; legacy record; result jsonb; business_tz text;
begin
    select s.*, coalesce(b.tz,'Asia/Bishkek') as business_tz into st
    from public.staff s join public.businesses b on b.id=s.biz_id where s.id=p_staff;
    if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
    business_tz := st.business_tz;
    result := jsonb_build_object('date',p_day,'branch_id',st.branch_id,'tz',business_tz,
        'source','unconfigured','intervals','[]'::jsonb,'breaks','[]'::jsonb);
    if not st.is_active then return result; end if;
    if exists(select 1 from public.staff_time_off t where t.staff_id=p_staff and t.biz_id=st.biz_id
              and p_day between t.date_from and t.date_to) then
        return result || jsonb_build_object('source','absence');
    end if;
    select * into v from public.staff_schedule_versions where staff_id=p_staff
        and kind='day' and effective_from=p_day order by revision desc limit 1;
    if found then
        return public.schedule_bound_to_branch(result || (v.days->'day') || jsonb_build_object('branch_id',v.branch_id,'source','day'),st.biz_id,p_day);
    end if;
    -- Never silently overwrite legacy date/range exceptions when publishing a week.
    if exists(select 1 from public.staff_schedule_rules r where r.staff_id=p_staff and r.is_active
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
        -- working_hours historically inherits the home branch. Freeze that history
        -- across transfers, but never override a legacy rule's explicit branch.
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
revoke all on function public.schedule_effective_day(uuid,date) from public, anon, authenticated;

-- Same signature for existing slot generators. Authenticated reads are limited to own/team data.
create function public.resolve_staff_day(p_staff_id uuid, p_date date)
returns table(branch_id uuid, tz text, intervals jsonb, breaks jsonb)
language plpgsql stable security definer set search_path = public
as $$
declare d jsonb; st record;
begin
    select * into st from public.staff where id=p_staff_id;
    if not found then return; end if;
    -- Direct browser calls are revoked. Existing public slot generators execute
    -- as their owner; the server read endpoint verifies employee/business scope.
    d := public.schedule_effective_day(p_staff_id,p_date);
    if d->>'source' in ('unconfigured','absence') then return; end if;
    return query select (d->>'branch_id')::uuid,d->>'tz',d->'intervals',d->'breaks';
end;
$$;
-- Public slot functions can call this as their definer; browsers use the scoped server API.
revoke all on function public.resolve_staff_day(uuid,date) from public, anon, authenticated;
grant execute on function public.resolve_staff_day(uuid,date) to service_role;

create function public.read_staff_schedule(p_staff uuid,p_biz uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare tz text; result jsonb;
begin
    if p_from is null or p_to is null or p_to<p_from or p_to-p_from>62 then raise exception 'SCHEDULE_INVALID'; end if;
    select coalesce(b.tz,'Asia/Bishkek') into tz from public.staff s join public.businesses b on b.id=s.biz_id
        where s.id=p_staff and s.biz_id=p_biz;
    if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
    select jsonb_agg(public.schedule_effective_day(p_staff,p_from+i) order by i) into result
        from generate_series(0,p_to-p_from) i;
    return jsonb_build_object('revision',(select coalesce(max(revision),0) from public.staff_schedule_versions where staff_id=p_staff),
        'timezone',tz,'today',(now() at time zone tz)::date,'days',result);
end;
$$;
revoke all on function public.read_staff_schedule(uuid,uuid,date,date) from public, anon, authenticated;
grant execute on function public.read_staff_schedule(uuid,uuid,date,date) to service_role;

-- Editor reads a plan, not fourteen resolved dates: exceptions must not leak into a weekly draft.
create function public.read_staff_schedule_draft(p_staff uuid,p_biz uuid,p_day date,p_kind text)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare st record; v record; result jsonb; days jsonb; branch uuid; source text := 'unconfigured';
begin
    select * into st from public.staff where id=p_staff and biz_id=p_biz and is_active;
    if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
    if p_day is null or p_kind is null or p_kind not in ('week','day') then raise exception 'SCHEDULE_INVALID'; end if;
    branch := st.branch_id;
    if p_kind='day' then
        result := public.schedule_effective_day(p_staff,p_day);
        branch := (result->>'branch_id')::uuid;
        days := jsonb_build_object('day',jsonb_build_object('intervals',result->'intervals','breaks',result->'breaks'));
        source := result->>'source';
    else
        select * into v from public.staff_schedule_versions where staff_id=p_staff and kind='week'
            and effective_from<=p_day order by effective_from desc,revision desc limit 1;
        if found then days:=v.days; branch:=v.branch_id; source:='week';
        else
            select jsonb_object_agg(k::text,jsonb_build_object('intervals',coalesce(w.intervals,'[]'::jsonb),
                'breaks',coalesce(w.breaks,'[]'::jsonb))) into days
                from generate_series(1,7) k left join public.working_hours w
                on w.staff_id=p_staff and w.biz_id=p_biz and w.day_of_week=k%7;
            if exists(select 1 from public.working_hours where staff_id=p_staff and biz_id=p_biz) then source:='legacy'; end if;
        end if;
    end if;
    return jsonb_build_object('days',days,'branchId',branch,'source',source,
        'revision',(select coalesce(max(revision),0) from public.staff_schedule_versions where staff_id=p_staff));
end;
$$;
revoke all on function public.read_staff_schedule_draft(uuid,uuid,date,text) from public,anon,authenticated;
grant execute on function public.read_staff_schedule_draft(uuid,uuid,date,text) to service_role;

-- Minimal projection for branch selectors: no identities, absence reasons or audit data.
create function public.read_staff_work_locations(p_biz uuid,p_from date,p_to date)
returns table(staff_id uuid,branch_id uuid,date_on date)
language plpgsql stable security definer set search_path = public
as $$
begin
    if p_from is null or p_to is null or p_to<p_from or p_to-p_from>62 then raise exception 'SCHEDULE_INVALID'; end if;
    return query select s.id,(d.value->>'branch_id')::uuid,p_from+i
        from public.staff s cross join generate_series(0,p_to-p_from) i
        cross join lateral (select public.schedule_effective_day(s.id,p_from+i) value) d
        where s.biz_id=p_biz and s.is_active and jsonb_array_length(d.value->'intervals')>0
        and (d.value->>'branch_id')::uuid is distinct from s.branch_id;
end;
$$;
revoke all on function public.read_staff_work_locations(uuid,date,date) from public, anon, authenticated;
grant execute on function public.read_staff_work_locations(uuid,date,date) to service_role;

create function public.schedule_validate_day(p_day jsonb)
returns void language plpgsql immutable set search_path = public
as $$
declare k text; part jsonb; last_end text; a text; z text;
begin
    if p_day is null or jsonb_typeof(p_day)<>'object' then raise exception 'SCHEDULE_INVALID'; end if;
    foreach k in array array['intervals','breaks'] loop
        if p_day->k is null or jsonb_typeof(p_day->k)<>'array' then raise exception 'SCHEDULE_INVALID'; end if;
        if jsonb_array_length(p_day->k)>8 then raise exception 'SCHEDULE_INVALID'; end if;
        last_end := '';
        for part in select * from jsonb_array_elements(p_day->k) loop
            a:=part->>'start'; z:=part->>'end';
            if a is null or z is null or a !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                or z !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or a>=z or a<last_end then
                raise exception 'SCHEDULE_INVALID';
            end if;
            if k='breaks' and not exists(select 1 from jsonb_array_elements(p_day->'intervals') w
                where w->>'start'<=a and w->>'end'>=z) then raise exception 'SCHEDULE_INVALID'; end if;
            last_end:=z;
        end loop;
    end loop;
end;
$$;
revoke all on function public.schedule_validate_day(jsonb) from public, anon, authenticated;

create function public.schedule_contains_booking(p_staff uuid,p_branch uuid,p_start timestamptz,p_end timestamptz)
returns boolean language plpgsql stable security definer set search_path = public
as $$
declare d jsonb; day date; tz text; a timestamp; z timestamp;
begin
    select coalesce(b.tz,'Asia/Bishkek') into tz from public.staff s join public.businesses b on b.id=s.biz_id where s.id=p_staff;
    day:=(p_start at time zone tz)::date;
    d:=public.schedule_effective_day(p_staff,day);
    a:=p_start at time zone tz; z:=p_end at time zone tz;
    return coalesce((d->>'branch_id')::uuid=p_branch and z>a and z::date=day
        and exists(select 1 from jsonb_array_elements(d->'intervals') w
            where day+(w->>'start')::time<=a and day+(w->>'end')::time>=z)
        and not exists(select 1 from jsonb_array_elements(d->'breaks') w
            where tsrange(day+(w->>'start')::time,day+(w->>'end')::time,'[)') && tsrange(a,z,'[)')),false);
end;
$$;
revoke all on function public.schedule_contains_booking(uuid,uuid,timestamptz,timestamptz) from public, anon, authenticated;

create function public.publish_staff_schedule(p_staff uuid,p_biz uuid,p_actor uuid,p_expected_revision bigint,
    p_kind text,p_from date,p_branch uuid,p_days jsonb)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare st record; tz text; rev bigint; k text; conflicts jsonb; created_id uuid; weekday int;
begin
    if not public.schedule_actor_can_manage(p_actor,p_biz) then raise exception 'SCHEDULE_FORBIDDEN'; end if;
    -- Serializes competing publications and booking writes for this employee.
    select * into st from public.staff where id=p_staff and biz_id=p_biz for update;
    if not found or not st.is_active then raise exception 'SCHEDULE_NOT_FOUND'; end if;
    select coalesce(b.tz,'Asia/Bishkek') into tz from public.businesses b where b.id=p_biz;
    if p_from is null or p_from<(now() at time zone tz)::date or p_kind not in ('week','day')
        or p_kind is null or p_days is null or jsonb_typeof(p_days)<>'object' then raise exception 'SCHEDULE_INVALID'; end if;
    if not exists(select 1 from public.branches where id=p_branch and biz_id=p_biz and is_active)
        then raise exception 'SCHEDULE_INVALID_BRANCH'; end if;
    select coalesce(max(revision),0) into rev from public.staff_schedule_versions where staff_id=p_staff;
    if p_expected_revision is distinct from rev then raise exception 'SCHEDULE_STALE'; end if;
    if (select count(*) from jsonb_object_keys(p_days))<>(case when p_kind='week' then 7 else 1 end)
        then raise exception 'SCHEDULE_INVALID'; end if;
    foreach k in array (case when p_kind='week' then array['1','2','3','4','5','6','7'] else array['day'] end) loop
        perform public.schedule_validate_day(p_days->k);
        weekday := case when p_kind='day' then extract(dow from p_from)::int else k::int % 7 end;
        if exists(select 1 from jsonb_array_elements(p_days->k->'intervals') work where not exists(
            select 1 from public.branch_working_hours h cross join lateral jsonb_array_elements(h.intervals) bounds
            where h.biz_id=p_biz and h.branch_id=p_branch and h.day_of_week=weekday
                and bounds->>'start'<=work->>'start' and bounds->>'end'>=work->>'end'))
        then raise exception 'SCHEDULE_OUTSIDE_BRANCH_HOURS'; end if;
    end loop;
    -- Nested transaction: failed conflict preview rolls back the candidate version.
    begin
        insert into public.staff_schedule_versions(staff_id,biz_id,branch_id,kind,effective_from,days,revision,created_by)
        values(p_staff,p_biz,p_branch,p_kind,p_from,p_days,rev+1,p_actor) returning id into created_id;
        select jsonb_agg(jsonb_build_object('id',b.id,'start_at',b.start_at,'end_at',b.end_at)) into conflicts
        from public.bookings b where b.staff_id=p_staff and b.biz_id=p_biz
            and (b.status::text in ('confirmed','paid') or (b.status::text='hold' and b.expires_at>now()))
            and (b.start_at at time zone tz)::date>=p_from
            and (p_kind='week' or (b.start_at at time zone tz)::date=p_from)
            and not public.schedule_contains_booking(p_staff,b.branch_id,b.start_at,b.end_at);
        if conflicts is not null then raise exception 'SCHEDULE_BOOKING_CONFLICT'; end if;
    exception when raise_exception then
        if sqlerrm='SCHEDULE_BOOKING_CONFLICT' then
            return jsonb_build_object('ok',false,'error','SCHEDULE_BOOKING_CONFLICT','conflicts',conflicts);
        end if;
        raise;
    end;
    return jsonb_build_object('ok',true,'revision',rev+1,'id',created_id);
end;
$$;
revoke all on function public.publish_staff_schedule(uuid,uuid,uuid,bigint,text,date,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.publish_staff_schedule(uuid,uuid,uuid,bigint,text,date,uuid,jsonb) to service_role;

-- The same lock and resolver protect migrated staff from stale/racing booking writes.
create function public.check_explicit_schedule_booking()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
    perform 1 from public.staff where id=new.staff_id for update;
    if new.status::text in ('hold','confirmed','paid')
        and exists(select 1 from public.staff_schedule_versions where staff_id=new.staff_id)
        and (TG_OP='INSERT' or new.start_at is distinct from old.start_at or new.end_at is distinct from old.end_at
             or new.staff_id is distinct from old.staff_id or new.branch_id is distinct from old.branch_id
             or (new.status::text in ('confirmed','paid') and old.status::text not in ('confirmed','paid')))
    then
        if not public.schedule_contains_booking(new.staff_id,new.branch_id,new.start_at,new.end_at)
            then raise exception 'SCHEDULE_OUTSIDE_WORKING_HOURS'; end if;
        if exists(select 1 from public.bookings b where b.staff_id=new.staff_id and b.id is distinct from new.id
            and (b.status::text in ('confirmed','paid') or (b.status::text='hold' and b.expires_at>now()))
            and tstzrange(b.start_at,b.end_at,'[)') && tstzrange(new.start_at,new.end_at,'[)'))
            then raise exception 'SCHEDULE_SLOT_TAKEN'; end if;
    end if;
    return new;
end;
$$;
revoke all on function public.check_explicit_schedule_booking() from public, anon, authenticated;
create trigger check_explicit_schedule_booking before insert or update on public.bookings
for each row execute function public.check_explicit_schedule_booking();

create function public.replace_branch_schedule(p_biz uuid,p_branch uuid,p_actor uuid,p_days jsonb)
returns void language plpgsql security definer set search_path = public
as $$
declare item jsonb;
begin
    if not public.schedule_actor_can_manage(p_actor,p_biz) then raise exception 'SCHEDULE_FORBIDDEN'; end if;
    perform 1 from public.branches where id=p_branch and biz_id=p_biz and is_active for update;
    if not found then raise exception 'SCHEDULE_INVALID_BRANCH'; end if;
    if p_days is null or jsonb_typeof(p_days)<>'array' then raise exception 'SCHEDULE_INVALID'; end if;
    if jsonb_array_length(p_days)<>7 or (select count(distinct x->>'day_of_week') from jsonb_array_elements(p_days) x)<>7
        then raise exception 'SCHEDULE_INVALID'; end if;
    for item in select * from jsonb_array_elements(p_days) loop
        if item->>'day_of_week' is null or item->>'day_of_week' !~ '^[0-6]$' then raise exception 'SCHEDULE_INVALID'; end if;
        perform public.schedule_validate_day(item);
    end loop;
    -- Same lock ordering for all employees, including those temporarily in this branch.
    perform 1 from public.staff where biz_id=p_biz order by id for update;
    delete from public.branch_working_hours where biz_id=p_biz and branch_id=p_branch;
    insert into public.branch_working_hours(biz_id,branch_id,day_of_week,intervals,breaks)
        select p_biz,p_branch,(x->>'day_of_week')::int,x->'intervals',x->'breaks' from jsonb_array_elements(p_days) x;
    if exists(select 1 from public.bookings b where b.biz_id=p_biz and b.branch_id=p_branch and b.end_at>now()
        and (b.status::text in ('confirmed','paid') or (b.status::text='hold' and b.expires_at>now()))
        and exists(select 1 from public.staff_schedule_versions v where v.staff_id=b.staff_id)
        and not public.schedule_contains_booking(b.staff_id,b.branch_id,b.start_at,b.end_at))
        then raise exception 'SCHEDULE_BOOKING_CONFLICT'; end if;
end;
$$;
revoke all on function public.replace_branch_schedule(uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.replace_branch_schedule(uuid,uuid,uuid,jsonb) to service_role;

-- A stale tab with the legacy editor must not bypass publication and its checks.
create function public.guard_legacy_staff_schedule_write()
returns trigger language plpgsql security definer set search_path = public
as $$
declare target uuid;
begin
    target := case when TG_OP='DELETE' then old.staff_id else new.staff_id end;
    perform 1 from public.staff where id=target for update;
    if exists(select 1 from public.staff_schedule_versions where staff_id=target)
        or (TG_OP='UPDATE' and exists(select 1 from public.staff_schedule_versions where staff_id=old.staff_id))
        then raise exception 'SCHEDULE_USE_PUBLICATION_EDITOR'; end if;
    if TG_OP='DELETE' then return old; end if;
    return new;
end;
$$;
revoke all on function public.guard_legacy_staff_schedule_write() from public,anon,authenticated;
create trigger guard_legacy_staff_schedule_write before insert or update or delete on public.staff_schedule_rules
for each row execute function public.guard_legacy_staff_schedule_write();
create trigger guard_legacy_working_hours_write before insert or update or delete on public.working_hours
for each row execute function public.guard_legacy_staff_schedule_write();
commit;
