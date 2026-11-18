-- Value range checks the schema lacked (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md DB-16).
-- The web forms validate these values, but any other writer (a script, PostgREST, future code)
-- could store a 150 % / -50 % split, a negative price or expense, a price range upside down, a
-- package discount of 300 %, a promotion that ends before it starts, or a time zone PostgreSQL does
-- not know - which breaks finance maths, the booking prices or every time conversion of the
-- business. Production had no violating rows on 2026-11-18, so the checks are validated at once;
-- the migration fails (and changes nothing) if a violating row appears before it runs.
begin;

set local lock_timeout = '5s';

-- IMMUTABLE so that CHECK constraints may use it: the answer depends only on the name.
create or replace function private.is_valid_time_zone(p_tz text)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog
as $$
begin
    perform pg_catalog.now() at time zone p_tz;
    return true;
exception when invalid_parameter_value then
    return false;
end;
$$;

comment on function private.is_valid_time_zone(text) is
    'True when PostgreSQL knows the time zone (IANA name such as Asia/Bishkek, or UTC). Used by CHECK constraints (DB-16).';

-- Every writer evaluates the checks, so every role may run this pure function.
revoke all on function private.is_valid_time_zone(text) from public;
grant execute on function private.is_valid_time_zone(text) to public;

alter table public.staff
    add constraint staff_percent_range_check
        check (percent_master between 0 and 100 and percent_salon between 0 and 100),
    add constraint staff_hourly_rate_check
        check (hourly_rate is null or hourly_rate >= 0);

alter table public.services
    add constraint services_price_range_check
        check (price_from >= 0 and price_to >= price_from);

alter table public.booking_services
    add constraint booking_services_duration_check
        check (duration_min > 0),
    add constraint booking_services_price_range_check
        check ((price_from is null or price_from >= 0) and (price_to is null or price_to >= coalesce(price_from, 0)));

alter table public.staff_shift_expenses
    add constraint staff_shift_expenses_amount_check
        check (amount >= 0 and amount <= 999999999999.99);

alter table public.visit_package_plans
    add constraint visit_package_plans_percent_check
        check (discount_type <> 'percent' or discount_value <= 100);

alter table public.branch_promotions
    add constraint branch_promotions_dates_check
        check (valid_from is null or valid_to is null or valid_from <= valid_to),
    -- The same rules as the promotion form: a percent from 1 to 100, at least one visit.
    add constraint branch_promotions_params_check
        check (
            (promotion_type not in ('birthday_discount', 'first_visit_discount')
                or not (params ? 'discount_percent')
                or case when jsonb_typeof(params -> 'discount_percent') = 'number'
                        then (params ->> 'discount_percent')::numeric between 1 and 100
                        else false end)
            and (promotion_type <> 'free_after_n_visits'
                or not (params ? 'visit_count')
                or case when jsonb_typeof(params -> 'visit_count') = 'number'
                        then (params ->> 'visit_count')::numeric >= 1
                        else false end)
        );

alter table public.businesses
    add constraint businesses_tz_check
        check (tz is null or private.is_valid_time_zone(tz));

alter table public.staff_schedule_rules
    add constraint staff_schedule_rules_tz_check
        check (private.is_valid_time_zone(tz));

alter table public.rating_global_config
    add constraint rating_global_config_window_days_check
        check (window_days > 0);

alter table public.rating_biz_config
    add constraint rating_biz_config_window_days_check
        check (window_days > 0);

commit;
