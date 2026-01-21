-- Миграция для добавления функции автоматического применения акций при оплате бронирования

-- Функция для применения акции к бронированию при отметке как "paid"
-- Приоритет применения акций (если подходят несколько одновременно):
--   1) first_visit_discount
--   2) birthday_discount
--   3) referral_free
--   4) referral_discount_50
--   5) free_after_n_visits
--   6) прочие типы (priority = 99, на будущее)
create or replace function public.apply_promotion_to_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_booking record;
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
    select array_agg(p.*) into v_promotions
    from public.branch_promotions p
    where p.branch_id = v_branch_id
      and p.is_active = true
      and (p.valid_from is null or p.valid_from <= CURRENT_DATE)
      and (p.valid_to is null or p.valid_to >= CURRENT_DATE)
      and public.can_use_promotion(v_client_id, v_branch_id, p.id)
    order by 
        case p.promotion_type
            when 'first_visit_discount' then 1
            when 'birthday_discount' then 2
            when 'referral_free' then 3
            when 'referral_discount_50' then 4
            when 'free_after_n_visits' then 5
            else 99
        end;
    
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
    declare
        v_base_price numeric;
    begin
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
    end;
    
    -- Записываем использование акции
    v_usage_data := jsonb_build_object(
        'original_amount', v_base_price,
        'final_amount', v_final_amount,
        'discount_percent', v_discount_percent,
        'applied_at', now()
    );
    
    -- Для free_after_n_visits добавляем счетчик посещений
    if v_promotion_type = 'free_after_n_visits' then
        v_visit_count := public.get_client_visit_count(v_client_id, v_branch_id);
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
        limit 1;
        
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
    
    return v_result;
exception
    when others then
        -- В случае ошибки возвращаем информацию об ошибке, но не прерываем процесс
        return jsonb_build_object(
            'applied', false,
            'error', SQLERRM,
            'reason', 'Error applying promotion'
        );
end;
$$;

comment on function public.apply_promotion_to_booking(uuid) is 'Применяет акцию к бронированию при отметке как paid. Возвращает JSON с информацией о примененной акции.';

-- Функция для обновления статуса бронирования с автоматическим применением акций
create or replace function public.update_booking_status_with_promotion(
    p_booking_id uuid,
    p_new_status booking_status
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_promotion_result jsonb;
begin
    -- Обновляем статус бронирования
    perform public.update_booking_status_no_check(p_booking_id, p_new_status);
    
    -- Если статус = 'paid', пытаемся применить акцию
    if p_new_status = 'paid' then
        v_promotion_result := public.apply_promotion_to_booking(p_booking_id);
        
        -- Сохраняем информацию о примененной акции в bookings.promotion_applied
        if v_promotion_result->>'applied' = 'true' then
            update public.bookings
            set promotion_applied = jsonb_build_object(
                'promotion_id', v_promotion_result->>'promotion_id',
                'promotion_type', v_promotion_result->>'promotion_type',
                'promotion_title', v_promotion_result->>'promotion_title',
                'original_amount', (v_promotion_result->>'original_amount')::numeric,
                'final_amount', (v_promotion_result->>'final_amount')::numeric,
                'discount_percent', (v_promotion_result->>'discount_percent')::numeric,
                'discount_amount', (v_promotion_result->>'discount_amount')::numeric,
                'applied_at', now()
            )
            where id = p_booking_id;
        end if;
        
        -- Возвращаем результат применения акции
        return coalesce(v_promotion_result, jsonb_build_object('applied', false, 'reason', 'No promotion applied'));
    end if;
    
    -- Если статус не 'paid', возвращаем пустой результат
    return jsonb_build_object('applied', false, 'reason', 'Status is not paid');
end;
$$;

comment on function public.update_booking_status_with_promotion(uuid, booking_status) is 'Обновляет статус бронирования и автоматически применяет акции при статусе paid.';

-- Добавляем поле для хранения информации о примененной акции в bookings (опционально)
-- Это позволит быстро видеть, применена ли акция к бронированию
alter table public.bookings 
add column if not exists promotion_applied jsonb;

comment on column public.bookings.promotion_applied is 'Информация о примененной акции (если была применена): {"promotion_id": uuid, "discount_percent": number, "final_amount": number}';

