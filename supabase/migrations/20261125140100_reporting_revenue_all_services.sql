-- R25-17 (docs/PROJECT_REVIEW_2026-11-25.md): revenue analytics disagreed with shift finance.
--   * a visit paid by a visit package counted at the full catalog price (subscription_applied was
--     ignored);
--   * a booking with several services counted only the catalog price of bookings.service_id;
--   * confirmed bookings that were never performed counted as revenue.
--
-- Owner decision (25 Nov): the revenue of a booking is the amount the visit was charged:
--   coalesce(subscription_applied.final_amount, promotion_applied.final_amount,
--            private.booking_catalog_amount(booking))
-- (the catalog amount of every service of the booking, 20261125140000), and only performed visits
-- (status 'paid') are revenue.
--
-- Redefined from their latest definitions (20261110110000_reporting_completeness), with the same
-- signatures, volatility, security, search_path and output shape; grants are kept by create or
-- replace:
--   public.recalculate_business_daily_stats(date,text)                 total_revenue, promo_revenue, promo_bookings
--   public.read_promotion_analytics_snapshot(uuid,date,date,uuid,text) summary, byDay, byType
-- What counts as a promoted booking (a non-empty promotion_applied.promotion_type) and the discount
-- given (original_amount - final_amount of the promotion) are unchanged; both now cover performed
-- visits only, like the revenue they sit next to. A promotion is applied only when a booking becomes
-- paid, so promo counts move only for a promoted booking whose status later left 'paid'.
--
-- Not changed: recalculate_business_hourly_load (20261125100000) counts load, not revenue: confirmed
-- bookings occupy staff time, so it keeps counting confirmed and paid bookings.
-- bookings_confirmed_or_paid in business_daily_stats counts analytics events, not bookings.

create or replace function public.recalculate_business_daily_stats(p_date date,p_default_tz text default 'Asia/Bishkek')
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
        -- R25-17: the charged amount of a performed visit (package, then promotion, then catalog).
        select b.id as biz_id, coalesce(k.promotion_applied->>'promotion_type','')<>'' as promoted,
            coalesce((k.subscription_applied->>'final_amount')::numeric,(k.promotion_applied->>'final_amount')::numeric,
                private.booking_catalog_amount(k.id)) as amount
        from bounds b join public.bookings k on k.biz_id=b.id and k.start_at>=b.starts_at and k.start_at<b.ends_at
            and k.status='paid'
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

create or replace function public.read_promotion_analytics_snapshot(p_biz_id uuid,p_date_from date,p_date_to date,p_branch_id uuid default null,p_default_tz text default 'Asia/Bishkek')
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
        -- R25-17: the charged amount of a performed visit (package, then promotion, then catalog).
        select (k.start_at at time zone v_tz)::date as date,nullif(k.promotion_applied->>'promotion_type','') as promotion_type,
            coalesce((k.subscription_applied->>'final_amount')::numeric,(k.promotion_applied->>'final_amount')::numeric,
                private.booking_catalog_amount(k.id)) as amount,
            case when coalesce(k.promotion_applied->>'promotion_type','')<>'' then greatest(0,coalesce((k.promotion_applied->>'original_amount')::numeric,0)-coalesce((k.promotion_applied->>'final_amount')::numeric,0)) else 0 end as discount
        from public.bookings k
        where k.biz_id=p_biz_id and (p_branch_id is null or k.branch_id=p_branch_id) and k.status='paid'
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
