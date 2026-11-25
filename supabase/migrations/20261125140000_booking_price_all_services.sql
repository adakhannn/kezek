-- R25-04 (docs/PROJECT_REVIEW_2026-11-25.md): a promotion or a visit-package benefit priced the
-- booking by the catalog price of bookings.service_id only. A booking "haircut 1000 + coloring 3000"
-- with a 10% promotion got final_amount 900, the staff member entered 3600, and the shift could not be
-- closed (SHIFT_PRICING_CHANGED: the close requires staff_shift_items.service_amount to equal the
-- benefit final_amount).
--
-- Owner decision (25 Nov): the benefit is computed from the catalog price of ALL services of the
-- booking. Example: 1000 + 3000 with 10% -> 3600; a 100% package -> 0 for the whole booking.
--
-- private.booking_catalog_amount(booking) is the one price rule, shared with the revenue reports
-- (20261125140100):
--   * the services of public.booking_services when the booking has such rows (a complex booking
--     lists every service, the primary one included), else the single bookings.service_id;
--   * each service counts at its catalog price (public.services, not the booking_services snapshot):
--     the midpoint of price_from..price_to when both are set, else whichever is set, else 0;
--   * the midpoint is computed in numeric and rounded to cents. services.price_from/price_to are
--     integers, and (price_from + price_to) / 2 truncated an odd sum: 1000..1501 was 1250, now 1250.50.
-- A single-service booking prices exactly as before, apart from that truncation.
--
-- The shift close check (20261110113000) is unchanged and still holds: save writes the benefit
-- final_amount into staff_shift_items.service_amount for a booking with a benefit, and close compares
-- the two, so the amount a manager sees and the amount the close accepts are now the full booking.
--
-- Redefined from their latest definitions (create or replace keeps owner, grants and comments):
--   public.apply_promotion_to_booking(uuid)                    20261125100000_business_time_zone_days
--   public.apply_visit_package_to_booking_impl_20261109(uuid)  prod baseline, renamed in 20261109090100,
--                                                              search_path pinned in 20261119060000
-- Only the base price changes; the rest of both bodies is verbatim.

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.booking_catalog_amount(p_booking_id uuid)
returns numeric language sql stable security definer set search_path = pg_catalog, public as $$
    with lines as (
        select s.price_from, s.price_to
        from public.booking_services bs
        left join public.services s on s.id = bs.service_id
        where bs.booking_id = p_booking_id
        union all
        select s.price_from, s.price_to
        from public.bookings b
        left join public.services s on s.id = b.service_id
        where b.id = p_booking_id
          and not exists (select 1 from public.booking_services bs where bs.booking_id = p_booking_id)
    )
    select coalesce(sum(case
        when price_from is not null and price_to is not null then round((price_from::numeric + price_to::numeric) / 2, 2)
        else coalesce(price_from, price_to, 0)::numeric end), 0)
    from lines;
$$;

-- Called only by the SECURITY DEFINER pricing and reporting functions (owner postgres): no client
-- role needs it.
revoke all on function private.booking_catalog_amount(uuid) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.apply_promotion_to_booking(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
    v_booking record;
    v_base_price numeric;
    v_client_id uuid;
    v_branch_id uuid;
    v_biz_id uuid;
    v_service_id uuid;
    v_promotions public.branch_promotions[];
    v_applied_promotion public.branch_promotions;
    v_discount_percent numeric;
    v_final_amount numeric;
    v_visit_count integer;
    v_promotion_type text;
    v_result jsonb;
    v_usage_data jsonb;
    v_has_referral boolean;
    v_referral_id uuid;
begin
    perform 1 from public.bookings where id=p_booking_id for update;
    perform public.assert_booking_finance_access(p_booking_id);
    if exists(select 1 from public.bookings where id=p_booking_id and promotion_applied is not null) then
        return (select jsonb_build_object('applied',true)||promotion_applied from public.bookings where id=p_booking_id);
    end if;
    -- Получаем данные бронирования
    select b.id, b.client_id, b.branch_id, b.biz_id, b.service_id, b.status
    into v_booking
    from public.bookings b
    where b.id = p_booking_id;
    
    if v_booking is null then
        raise exception 'Booking not found';
    end if;
    
    -- Проверяем, что статус = 'paid' (услуга выполнена)
    if v_booking.status != 'paid' then
        return jsonb_build_object('applied', false, 'reason', 'Booking status is not paid');
    end if;
    
    -- Проверяем, что есть client_id (только для авторизованных клиентов)
    if v_booking.client_id is null then
        return jsonb_build_object('applied', false, 'reason', 'No client_id (guest booking)');
    end if;
    
    v_client_id := v_booking.client_id;
    v_branch_id := v_booking.branch_id;
    v_biz_id := v_booking.biz_id;
    v_service_id := v_booking.service_id;
    
    -- Получаем все активные и допустимые по условиям использования акции для этого филиала
    select array_agg(p order by case p.promotion_type
        when 'first_visit_discount' then 1 when 'birthday_discount' then 2
        when 'referral_free' then 3 when 'referral_discount_50' then 4 when 'free_after_n_visits' then 5 else 99 end,p.id)
    into v_promotions from public.branch_promotions p
    where p.branch_id=v_branch_id and p.biz_id=v_biz_id and p.is_active=true
        and (p.valid_from is null or p.valid_from<=(now() at time zone coalesce((select nullif(btrim(z.tz),'') from public.businesses z where z.id=v_biz_id),'Asia/Bishkek'))::date)
        and (p.valid_to is null or p.valid_to>=(now() at time zone coalesce((select nullif(btrim(z.tz),'') from public.businesses z where z.id=v_biz_id),'Asia/Bishkek'))::date)
        and public.can_use_promotion(v_client_id,v_branch_id,p.id,p_booking_id);
    
    -- Если нет доступных акций, возвращаем без изменений
    if v_promotions is null or array_length(v_promotions, 1) = 0 then
        return jsonb_build_object('applied', false, 'reason', 'No applicable promotions');
    end if;
    
    -- Берем первую подходящую акцию (с наивысшим приоритетом)
    v_applied_promotion := v_promotions[1];
    v_promotion_type := v_applied_promotion.promotion_type;
    
    -- Проверяем, не использована ли уже эта акция для этого бронирования
    if exists (
        select 1 from public.client_promotion_usage
        where booking_id = p_booking_id and promotion_id = v_applied_promotion.id
    ) then
        return jsonb_build_object('applied', false, 'reason', 'Promotion already applied to this booking');
    end if;
    
    -- R25-04: the catalog price of every service of the booking (booking_services), not only the
    -- primary one; a range price counts at its exact midpoint.
        v_base_price := private.booking_catalog_amount(p_booking_id);
        
        -- Применяем акцию
        case v_promotion_type
            when 'free_after_n_visits', 'referral_free' then
                -- Бесплатная услуга
                v_final_amount := 0;
                v_discount_percent := 100;
                
            when 'referral_discount_50' then
                -- Скидка 50%
                v_final_amount := round(v_base_price * 0.5, 2);
                v_discount_percent := 50;
                
            when 'first_visit_discount', 'birthday_discount' then
                -- Скидка в процентах из параметров
                v_discount_percent := (v_applied_promotion.params->>'discount_percent')::numeric;
                if v_discount_percent is null or v_discount_percent < 0 or v_discount_percent > 100 then
                    v_discount_percent := 0;
                end if;
                v_final_amount := round(v_base_price * (1 - v_discount_percent / 100), 2);
                
            else
                v_final_amount := v_base_price;
                v_discount_percent := 0;
        end case;
    
    -- Записываем использование акции
    v_usage_data := jsonb_build_object(
        'original_amount', v_base_price,
        'final_amount', v_final_amount,
        'discount_percent', v_discount_percent,
        'applied_at', now()
    );
    
    -- Для free_after_n_visits добавляем счетчик посещений
    if v_promotion_type = 'free_after_n_visits' then
        v_visit_count := public.get_client_visit_count(v_client_id, v_branch_id, p_booking_id);
        v_usage_data := v_usage_data || jsonb_build_object('visit_count', v_visit_count + 1);
    end if;
    
    -- Для реферальных акций - отмечаем реферальную связь как использованную
    if v_promotion_type in ('referral_free', 'referral_discount_50') then
        -- Находим неиспользованную реферальную связь
        select id into v_referral_id
        from public.client_referrals
        where referrer_id = v_client_id
          and branch_id = v_branch_id
          and referrer_bonus_used = false
        order by id limit 1 for update;
        
        if v_referral_id is null then raise exception using errcode='40001',message='PROMOTION_CHANGED'; end if;
        if v_referral_id is not null then
            -- Отмечаем реферальную связь как использованную
            update public.client_referrals
            set referrer_bonus_used = true, referrer_booking_id = p_booking_id
            where id = v_referral_id;
        end if;
    end if;
    
    -- Сохраняем факт использования акции
    insert into public.client_promotion_usage (
        client_id, branch_id, biz_id, promotion_id, promotion_type,
        booking_id, usage_data
    ) values (
        v_client_id, v_branch_id, v_biz_id, v_applied_promotion.id, v_applied_promotion.promotion_type,
        p_booking_id, v_usage_data
    );
    
    -- Формируем результат
    v_result := jsonb_build_object(
        'applied', true,
        'promotion_id', v_applied_promotion.id,
        'promotion_type', v_promotion_type,
        'promotion_title', v_applied_promotion.title_ru,
        'original_amount', v_base_price,
        'final_amount', v_final_amount,
        'discount_percent', v_discount_percent,
        'discount_amount', v_base_price - v_final_amount
    );
    
    update public.bookings set promotion_applied=(v_result-'applied')||jsonb_build_object('applied_at',now()) where id=p_booking_id;
    return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.apply_visit_package_to_booking_impl_20261109(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
    v_cvp_id uuid;
    v_booking record;
    v_plan record;
    v_base_price numeric;
    v_final_amount numeric;
    v_remaining_after int;
    v_plan_name_ru text;
begin
    v_cvp_id := public.get_applicable_visit_package_for_booking(p_booking_id);
    if v_cvp_id is null then
        return jsonb_build_object('applied', false, 'reason', 'No applicable visit package');
    end if;

    select b.id, b.client_id, b.branch_id, b.service_id
    into v_booking
    from public.bookings b
    where b.id = p_booking_id;

    select p.id, p.name_ru, p.discount_type, p.discount_value
    into v_plan
    from public.visit_package_plans p
    join public.client_visit_packages cvp on cvp.plan_id = p.id
    where cvp.id = v_cvp_id;

    -- R25-04: the catalog price of every service of the booking (booking_services), not only the
    -- primary one; a range price counts at its exact midpoint.
    v_base_price := private.booking_catalog_amount(p_booking_id);

    if v_base_price is null then
        v_base_price := 0;
    end if;

    if v_plan.discount_type = 'percent' then
        v_final_amount := round(v_base_price * (1 - least(v_plan.discount_value, 100) / 100), 2);
    else
        v_final_amount := least(v_plan.discount_value, v_base_price);
    end if;
    v_final_amount := greatest(0, v_final_amount);

    update public.client_visit_packages
    set remaining_visits = remaining_visits - 1
    where id = v_cvp_id
      and remaining_visits > 0
    returning remaining_visits into v_remaining_after;

    if v_remaining_after is null then
        return jsonb_build_object('applied', false, 'reason', 'Package visit count race');
    end if;

    insert into public.client_visit_package_uses (client_visit_package_id, booking_id)
    values (v_cvp_id, p_booking_id);

    v_plan_name_ru := v_plan.name_ru;

    update public.bookings
    set subscription_applied = jsonb_build_object(
        'plan_id', v_plan.id,
        'plan_name_ru', v_plan_name_ru,
        'client_visit_package_id', v_cvp_id,
        'final_amount', v_final_amount,
        'remaining_after', v_remaining_after,
        'applied_at', now()
    )
    where id = p_booking_id;

    return jsonb_build_object(
        'applied', true,
        'plan_id', v_plan.id,
        'plan_name_ru', v_plan_name_ru,
        'promotion_title', v_plan_name_ru,
        'final_amount', v_final_amount,
        'remaining_after', v_remaining_after
    );
end;
$function$
;
