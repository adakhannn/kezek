-- A promotion counts the client's visits before the booking it prices (docs/ENGINEERING_FINDINGS.md ENG-123).
--
-- update_booking_status_with_promotion marks a booking paid and then prices it:
-- apply_promotion_to_booking -> can_use_promotion -> get_client_visit_count counted every paid booking
-- of the client in the branch that had ended, the booking being priced included. Bookings are marked
-- paid after the visit (attendance, shift close), so that booking was counted too: the first-visit
-- discount never applied, and "every N-th visit free" fell on visit N-1 (with N = 7 the sixth visit was
-- free and the seventh was not). The usage record stored the same inflated visit number.
--
-- The visit count and the promotion check now take the booking being priced and leave it out; every
-- other rule is unchanged. Only apply_promotion_to_booking called the two helpers, so their old
-- signatures are dropped. Production had no active promotion when this was written. Re-running
-- changes nothing.

drop function if exists public.can_use_promotion(uuid, uuid, uuid);
drop function if exists public.get_client_visit_count(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_client_visit_count(p_client_id uuid, p_branch_id uuid, p_exclude_booking_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_count integer;
begin
    -- Считаем только завершенные (paid) бронирования в этом филиале, кроме оцениваемой брони
    select count(*)::integer
    into v_count
    from public.bookings
    where client_id = p_client_id
      and branch_id = p_branch_id
      and status = 'paid'
      and end_at < now()
      and id is distinct from p_exclude_booking_id;
    
    return coalesce(v_count, 0);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.can_use_promotion(p_client_id uuid, p_branch_id uuid, p_promotion_id uuid, p_booking_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
    v_promotion public.branch_promotions;
    v_visit_count integer;
    v_has_referral boolean;
    v_is_first_visit boolean;
    v_today_birthday boolean;
begin
    -- Получаем акцию
    select * into v_promotion
    from public.branch_promotions
    where id = p_promotion_id
      and branch_id = p_branch_id
      and is_active = true
      and (valid_from is null or valid_from <= CURRENT_DATE)
      and (valid_to is null or valid_to >= CURRENT_DATE);
    
    if v_promotion is null then
        return false; -- Акция не найдена или неактивна
    end if;
    
    -- Проверяем по типу акции
    case v_promotion.promotion_type
        when 'free_after_n_visits' then
            -- Для free_after_n_visits: проверяем, что текущее количество посещений кратно N-1
            -- Например, для 7-й услуги бесплатно: visit_count должно быть 6, 13, 20, и т.д.
            v_visit_count := public.get_client_visit_count(p_client_id, p_branch_id, p_booking_id);
            declare
                v_n integer := (v_promotion.params->>'visit_count')::integer;
            begin
                if v_n is null or v_n < 1 then
                    return false;
                end if;
                -- Проверяем, что следующее посещение будет N-м (например, 7-м)
                return (v_visit_count + 1) % v_n = 0;
            end;
            
        when 'referral_free', 'referral_discount_50' then
            -- Для реферальных акций: проверяем, что у клиента есть неиспользованный бонус
            select exists (
                select 1
                from public.client_referrals
                where referrer_id = p_client_id
                  and branch_id = p_branch_id
                  and referrer_bonus_used = false
            ) into v_has_referral;
            return v_has_referral;
            
        when 'first_visit_discount' then
            -- Для скидки за первый визит: проверяем, что это первый визит в этот филиал
            v_visit_count := public.get_client_visit_count(p_client_id, p_branch_id, p_booking_id);
            return v_visit_count = 0;
            
        when 'birthday_discount' then
            -- Для скидки в день рождения: проверяем, что сегодня день рождения клиента
            -- TODO: Нужно добавить поле birthday в profiles или clients
            -- Пока возвращаем false
            return false;
            
        else
            return false;
    end case;
end;
$function$
;

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
    select 
        b.id, b.client_id, b.branch_id, b.biz_id, b.service_id, b.status,
        s.price_from, s.price_to
    into v_booking
    from public.bookings b
    left join public.services s on s.id = b.service_id
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
        and (p.valid_from is null or p.valid_from<=current_date)
        and (p.valid_to is null or p.valid_to>=current_date)
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
    
    -- Рассчитываем сумму с учетом акции
    -- Используем price_from как базовую цену (или среднее между price_from и price_to)
        if v_booking.price_from is not null and v_booking.price_to is not null then
            v_base_price := (v_booking.price_from + v_booking.price_to) / 2;
        elsif v_booking.price_from is not null then
            v_base_price := v_booking.price_from;
        elsif v_booking.price_to is not null then
            v_base_price := v_booking.price_to;
        else
            v_base_price := 0;
        end if;
        
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

-- The helpers stay service-only, as 20261116120000 left them; the pricing function has no API grant.
revoke all on function public.get_client_visit_count(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.can_use_promotion(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_client_visit_count(uuid, uuid, uuid) to service_role;
grant execute on function public.can_use_promotion(uuid, uuid, uuid, uuid) to service_role;
revoke all on function public.apply_promotion_to_booking(uuid) from public, anon, authenticated, service_role;
