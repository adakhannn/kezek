-- Reports are single JSON snapshots, not REST row sets subject to max_rows.
-- Cron replaces one local business date atomically, including now-empty buckets.
begin;
create function public.read_finance_report_snapshot(
    p_biz_id uuid,p_date_from date,p_date_to date,p_staff_id uuid default null,p_branch_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
    if p_biz_id is null or p_date_from is null or p_date_to is null or p_date_to-p_date_from not between 0 and 365 then
        raise exception using errcode='22023',message='REPORT_SCOPE_OR_RANGE_INVALID';
    end if;
    if p_staff_id is not null and not exists(select 1 from public.staff where id=p_staff_id and biz_id=p_biz_id)
       or p_branch_id is not null and not exists(select 1 from public.branches where id=p_branch_id and biz_id=p_biz_id) then
        raise exception using errcode='42501',message='REPORT_SCOPE_INVALID';
    end if;
    if exists(select 1 from public.staff_shifts sh left join public.staff st on st.id=sh.staff_id and st.biz_id=p_biz_id
        where sh.biz_id=p_biz_id and sh.shift_date between p_date_from and p_date_to
        and (p_staff_id is null or sh.staff_id=p_staff_id) and (p_branch_id is null or sh.branch_id=p_branch_id) and st.id is null) then
        raise exception using errcode='23514',message='REPORT_STAFF_REFERENCE_INVALID';
    end if;
    return (with selected_shifts as materialized (
    select s.* from public.staff_shifts s
    where s.biz_id=p_biz_id and s.shift_date between p_date_from and p_date_to
      and (p_staff_id is null or s.staff_id=p_staff_id)
      and (p_branch_id is null or s.branch_id=p_branch_id)
), selected_staff as materialized (
    select s.id,s.full_name,s.is_active,s.hourly_rate,s.percent_master,s.percent_salon,s.branch_id
    from public.staff s where s.biz_id=p_biz_id and (p_staff_id is null or s.id=p_staff_id)
      and (p_branch_id is null or s.branch_id=p_branch_id or exists(select 1 from selected_shifts sh where sh.staff_id=s.id))
), closed as (
    select staff_id,count(*) as closed_shifts,coalesce(sum(total_amount),0) as total_amount,
        coalesce(sum(master_share),0) as total_master,coalesce(sum(salon_share),0) as total_salon,
        coalesce(sum(consumables_amount),0) as total_consumables,coalesce(sum(late_minutes),0) as total_late_minutes
    from selected_shifts where status='closed' group by staff_id
), details as (
    select s.*,
        jsonb_build_object('hourly_rate',st.hourly_rate,'percent_master',st.percent_master,'percent_salon',st.percent_salon) as staff,
        coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at,i.id) from public.staff_shift_items i where i.shift_id=s.id),'[]'::jsonb) as items
    from selected_shifts s join selected_staff st on st.id=s.staff_id
    where p_staff_id is not null or s.status='open'
)
select jsonb_build_object(
    'branches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.name,b.id) from public.branches b where b.biz_id=p_biz_id),'[]'::jsonb),
    'staff',coalesce((select jsonb_agg(to_jsonb(st) order by st.full_name,st.id) from selected_staff st),'[]'::jsonb),
    'closedStats',coalesce((select jsonb_agg(to_jsonb(c) order by c.staff_id) from closed c),'[]'::jsonb),
    'shifts',coalesce((select jsonb_agg(to_jsonb(d) order by d.shift_date desc,d.id) from details d),'[]'::jsonb)
));
end;
$$;
revoke all on function public.read_finance_report_snapshot(uuid,date,date,uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_finance_report_snapshot(uuid,date,date,uuid,uuid) to service_role;

create function public.recalculate_business_daily_stats(p_date date,p_default_tz text default 'Asia/Bishkek')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_rows jsonb; v_updated integer;
begin
    if p_date is null then raise exception using errcode='22023',message='ANALYTICS_DATE_REQUIRED'; end if;
    perform pg_advisory_xact_lock(7101201,p_date-date '2000-01-01');
    with bounds as materialized (
        select b.id, p_date::timestamp at time zone coalesce(nullif(btrim(b.tz),''),p_default_tz) as starts_at,
            (p_date+1)::timestamp at time zone coalesce(nullif(btrim(b.tz),''),p_default_tz) as ends_at
        from public.businesses b
    ), events as (
        select b.id as biz_id,
            count(*) filter(where e.event_type='home_view') as home_views,
            count(*) filter(where e.event_type='business_page_view') as business_page_views,
            count(*) filter(where e.event_type='booking_flow_start') as booking_flow_starts,
            count(*) filter(where e.event_type='booking_created') as bookings_created,
            count(*) filter(where e.event_type='booking_confirmed_or_paid') as bookings_confirmed_or_paid
        from bounds b join public.analytics_events e on e.biz_id=b.id and e.created_at>=b.starts_at and e.created_at<b.ends_at
        group by b.id
    ), amounts as (
        select b.id as biz_id, coalesce(k.promotion_applied->>'promotion_type','')<>'' as promoted,
            case when coalesce(k.promotion_applied->>'promotion_type','')<>''
                then coalesce((k.promotion_applied->>'final_amount')::numeric,0)
                when s.price_from is not null and s.price_to is not null then (s.price_from::numeric+s.price_to::numeric)/2
                else coalesce(s.price_from,s.price_to,0)::numeric end as amount
        from bounds b join public.bookings k on k.biz_id=b.id and k.start_at>=b.starts_at and k.start_at<b.ends_at
            and k.status in ('confirmed','paid')
        left join public.services s on s.id=k.service_id
    ), revenue as (
        select biz_id,count(*) filter(where promoted) as promo_bookings,
            coalesce(sum(amount) filter(where promoted),0) as promo_revenue,coalesce(sum(amount),0) as total_revenue
        from amounts group by biz_id
    ), rows as (
        select coalesce(e.biz_id,r.biz_id) as biz_id,p_date as date,
            coalesce(e.home_views,0) as home_views,coalesce(e.business_page_views,0) as business_page_views,
            coalesce(e.booking_flow_starts,0) as booking_flow_starts,coalesce(e.bookings_created,0) as bookings_created,
            coalesce(e.bookings_confirmed_or_paid,0) as bookings_confirmed_or_paid,
            coalesce(r.promo_bookings,0) as promo_bookings,coalesce(r.promo_revenue,0) as promo_revenue,coalesce(r.total_revenue,0) as total_revenue
        from events e full join revenue r on r.biz_id=e.biz_id
    ) select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) into v_rows from rows;
    -- Invalid numeric metadata must fail the whole replacement, not save NaN/Infinity.
    if exists(select 1 from jsonb_array_elements(v_rows) r where r->>'total_revenue' in ('NaN','Infinity','-Infinity') or r->>'promo_revenue' in ('NaN','Infinity','-Infinity')) then
        raise exception using errcode='22023',message='ANALYTICS_AMOUNT_INVALID';
    end if;
    insert into public.business_daily_stats(biz_id,date,home_views,business_page_views,booking_flow_starts,
        bookings_created,bookings_confirmed_or_paid,promo_bookings,promo_revenue,total_revenue,updated_at)
    select biz_id,date,home_views,business_page_views,booking_flow_starts,bookings_created,bookings_confirmed_or_paid,
        promo_bookings,promo_revenue,total_revenue,now()
    from jsonb_to_recordset(v_rows) as r(biz_id uuid,date date,home_views integer,business_page_views integer,
        booking_flow_starts integer,bookings_created integer,bookings_confirmed_or_paid integer,promo_bookings integer,
        promo_revenue numeric,total_revenue numeric)
    on conflict(biz_id,date) do update set home_views=excluded.home_views,business_page_views=excluded.business_page_views,
        booking_flow_starts=excluded.booking_flow_starts,bookings_created=excluded.bookings_created,
        bookings_confirmed_or_paid=excluded.bookings_confirmed_or_paid,promo_bookings=excluded.promo_bookings,
        promo_revenue=excluded.promo_revenue,total_revenue=excluded.total_revenue,updated_at=excluded.updated_at;
    get diagnostics v_updated=row_count;
    delete from public.business_daily_stats s where s.date=p_date and not exists(
        select 1 from jsonb_array_elements(v_rows) r where (r->>'biz_id')::uuid=s.biz_id);
    return jsonb_build_object('date',p_date,'updated',v_updated);
end;
$$;
revoke all on function public.recalculate_business_daily_stats(date,text) from public,anon,authenticated;
grant execute on function public.recalculate_business_daily_stats(date,text) to service_role;

create function public.recalculate_business_hourly_load(p_date date,p_default_tz text default 'Asia/Bishkek')
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_rows jsonb; v_updated integer;
begin
    if p_date is null then raise exception using errcode='22023',message='ANALYTICS_DATE_REQUIRED'; end if;
    perform pg_advisory_xact_lock(7101202,p_date-date '2000-01-01');
    with bounds as materialized (
        select b.id,coalesce(nullif(btrim(b.tz),''),p_default_tz) as tz,
            p_date::timestamp at time zone coalesce(nullif(btrim(b.tz),''),p_default_tz) as starts_at,
            (p_date+1)::timestamp at time zone coalesce(nullif(btrim(b.tz),''),p_default_tz) as ends_at
        from public.businesses b
    ), rows as (
        select b.id as biz_id,k.branch_id,p_date as date,extract(hour from k.start_at at time zone b.tz)::integer as hour,
            count(*) as bookings_count,count(*) filter(where coalesce(k.promotion_applied->>'promotion_type','')<>'') as promo_bookings_count,
            nullif(count(distinct k.staff_id),0) as staff_count,nullif(count(distinct k.client_id),0) as unique_clients_count
        from bounds b join public.bookings k on k.biz_id=b.id and k.start_at>=b.starts_at and k.start_at<b.ends_at
            and k.status in ('confirmed','paid') and k.branch_id is not null
        group by b.id,k.branch_id,extract(hour from k.start_at at time zone b.tz)
    ) select coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb) into v_rows from rows;
    insert into public.business_hourly_load(biz_id,branch_id,date,hour,bookings_count,promo_bookings_count,staff_count,unique_clients_count,updated_at)
    select biz_id,branch_id,date,hour,bookings_count,promo_bookings_count,staff_count,unique_clients_count,now()
    from jsonb_to_recordset(v_rows) as r(biz_id uuid,branch_id uuid,date date,hour integer,bookings_count integer,
        promo_bookings_count integer,staff_count integer,unique_clients_count integer)
    on conflict(biz_id,branch_id,date,hour) do update set bookings_count=excluded.bookings_count,
        promo_bookings_count=excluded.promo_bookings_count,staff_count=excluded.staff_count,
        unique_clients_count=excluded.unique_clients_count,updated_at=excluded.updated_at;
    get diagnostics v_updated=row_count;
    delete from public.business_hourly_load s where s.date=p_date and not exists(select 1 from jsonb_array_elements(v_rows) r
        where (r->>'biz_id')::uuid=s.biz_id and (r->>'branch_id')::uuid=s.branch_id and (r->>'hour')::integer=s.hour);
    return jsonb_build_object('date',p_date,'updated',v_updated);
end;
$$;
revoke all on function public.recalculate_business_hourly_load(date,text) from public,anon,authenticated;
grant execute on function public.recalculate_business_hourly_load(date,text) to service_role;

-- Readers return one scalar JSON value: PostgREST max_rows cannot truncate nested rows.
-- Global output is rolled up by date, never a dump of tenant-level records.
create function public.read_analytics_report_snapshot(p_date_from date,p_date_to date,p_biz_id uuid default null,p_branch_id uuid default null,p_kind text default 'daily')
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_result jsonb;
begin
    if p_date_from is null or p_date_to is null or p_date_to-p_date_from not between 0 and 365 or p_kind not in ('daily','hourly','global') then
        raise exception using errcode='22023',message='REPORT_SCOPE_OR_RANGE_INVALID';
    end if;
    if (p_kind='global' and (p_biz_id is not null or p_branch_id is not null)) or (p_kind<>'global' and p_biz_id is null) then
        raise exception using errcode='22023',message='REPORT_SCOPE_INVALID';
    end if;
    if p_branch_id is not null and not exists(select 1 from public.branches where id=p_branch_id and biz_id=p_biz_id) then
        raise exception using errcode='42501',message='REPORT_SCOPE_INVALID';
    end if;
    if p_kind='global' then
        with selected as materialized (select * from public.business_daily_stats where date between p_date_from and p_date_to), days as (
            select date,count(distinct biz_id) as active_businesses,sum(home_views) as home_views,sum(business_page_views) as business_page_views,
                sum(booking_flow_starts) as booking_flow_starts,sum(bookings_created) as bookings_created,
                sum(bookings_confirmed_or_paid) as bookings_confirmed_or_paid,sum(promo_bookings) as promo_bookings,
                sum(promo_revenue) as promo_revenue,sum(total_revenue) as total_revenue from selected group by date
        ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(d) order by date) from days d),'[]'::jsonb),
            'activeBusinesses',(select count(distinct biz_id) from selected)) into v_result;
    elsif p_kind='daily' then
        if p_branch_id is not null then raise exception using errcode='22023',message='DAILY_BRANCH_BREAKDOWN_UNAVAILABLE'; end if;
        select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(d) order by date),'[]'::jsonb)) into v_result
        from public.business_daily_stats d where biz_id=p_biz_id and date between p_date_from and p_date_to;
    else
        -- Preserve per-branch points and their counts. Distinct clients/staff across branches
        -- cannot be recovered by adding preaggregated counts; do not claim those are unique.
        select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(h) order by date,hour,branch_id),'[]'::jsonb)) into v_result
        from public.business_hourly_load h where biz_id=p_biz_id and date between p_date_from and p_date_to and (p_branch_id is null or branch_id=p_branch_id);
    end if;
    return v_result;
end;
$$;
revoke all on function public.read_analytics_report_snapshot(date,date,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.read_analytics_report_snapshot(date,date,uuid,uuid,text) to service_role;

-- Promotion totals and both breakdowns share the same live booking snapshot, branch
-- predicate and local-day bounds. The previous daily aggregate has no branch_id.
create function public.read_promotion_analytics_snapshot(p_biz_id uuid,p_date_from date,p_date_to date,p_branch_id uuid default null,p_default_tz text default 'Asia/Bishkek')
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_tz text; v_result jsonb;
begin
    if p_biz_id is null or p_date_from is null or p_date_to is null or p_date_to-p_date_from not between 0 and 365 then
        raise exception using errcode='22023',message='REPORT_SCOPE_OR_RANGE_INVALID';
    end if;
    select coalesce(nullif(btrim(tz),''),p_default_tz) into v_tz from public.businesses where id=p_biz_id;
    if v_tz is null or (p_branch_id is not null and not exists(select 1 from public.branches where id=p_branch_id and biz_id=p_biz_id)) then
        raise exception using errcode='42501',message='REPORT_SCOPE_INVALID';
    end if;
    with amounts as materialized (
        select (k.start_at at time zone v_tz)::date as date,nullif(k.promotion_applied->>'promotion_type','') as promotion_type,
            case when coalesce(k.promotion_applied->>'promotion_type','')<>'' then coalesce((k.promotion_applied->>'final_amount')::numeric,0)
                when s.price_from is not null and s.price_to is not null then (s.price_from::numeric+s.price_to::numeric)/2
                else coalesce(s.price_from,s.price_to,0)::numeric end as amount,
            case when coalesce(k.promotion_applied->>'promotion_type','')<>'' then greatest(0,coalesce((k.promotion_applied->>'original_amount')::numeric,0)-coalesce((k.promotion_applied->>'final_amount')::numeric,0)) else 0 end as discount
        from public.bookings k left join public.services s on s.id=k.service_id
        where k.biz_id=p_biz_id and (p_branch_id is null or k.branch_id=p_branch_id) and k.status in ('confirmed','paid')
            and k.start_at>=p_date_from::timestamp at time zone v_tz and k.start_at<(p_date_to+1)::timestamp at time zone v_tz
    ), days as (
        select date,count(*) filter(where promotion_type is not null) as "promoBookings",
            coalesce(sum(amount) filter(where promotion_type is not null),0) as "promoRevenue",sum(amount) as "totalRevenue" from amounts group by date
    ), types as (
        select promotion_type as "promotionType",count(*) as bookings,sum(amount) as revenue,sum(discount) as "discountGiven"
        from amounts where promotion_type is not null group by promotion_type
    ) select jsonb_build_object('summary',jsonb_build_object('promoBookings',(select count(*) from amounts where promotion_type is not null),
        'promoRevenue',coalesce((select sum(amount) from amounts where promotion_type is not null),0),'totalRevenue',coalesce((select sum(amount) from amounts),0)),
        'byDay',coalesce((select jsonb_agg(to_jsonb(d) order by date) from days d),'[]'::jsonb),
        'byType',coalesce((select jsonb_agg(to_jsonb(t) order by "promotionType") from types t),'[]'::jsonb)) into v_result;
    if v_result->'summary'->>'totalRevenue' in ('NaN','Infinity','-Infinity') or v_result->'summary'->>'promoRevenue' in ('NaN','Infinity','-Infinity')
        or exists(select 1 from jsonb_array_elements(v_result->'byType') t where t->>'discountGiven' in ('NaN','Infinity','-Infinity')) then
        raise exception using errcode='22023',message='ANALYTICS_AMOUNT_INVALID';
    end if;
    return v_result;
end;
$$;
revoke all on function public.read_promotion_analytics_snapshot(uuid,date,date,uuid,text) from public,anon,authenticated;
grant execute on function public.read_promotion_analytics_snapshot(uuid,date,date,uuid,text) to service_role;


-- Existing all-time staff statistics need historical dates for the period selector.
-- One explicitly selected staff member; invoker permissions/RLS remain in force.
create function public.read_staff_finance_history(p_biz_id uuid,p_staff_id uuid,p_date_from date default null,p_date_to date default null)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
begin
    if p_biz_id is null or p_staff_id is null or (p_date_from is not null and p_date_to is not null and p_date_from>p_date_to) then
        raise exception using errcode='22023',message='REPORT_SCOPE_OR_RANGE_INVALID';
    end if;
    if not exists(select 1 from public.staff where id=p_staff_id and biz_id=p_biz_id) then
        raise exception using errcode='42501',message='REPORT_SCOPE_INVALID';
    end if;
    return coalesce((select jsonb_agg(to_jsonb(s) order by shift_date desc,id) from (
        select id,shift_date,status,total_amount,master_share,salon_share,late_minutes,guaranteed_amount,topup_amount
        from public.staff_shifts where biz_id=p_biz_id and staff_id=p_staff_id
            and (p_date_from is null or shift_date>=p_date_from) and (p_date_to is null or shift_date<=p_date_to)
    ) s),'[]'::jsonb);
end;
$$;
revoke all on function public.read_staff_finance_history(uuid,uuid,date,date) from public,anon;
grant execute on function public.read_staff_finance_history(uuid,uuid,date,date) to authenticated,service_role;

commit;
