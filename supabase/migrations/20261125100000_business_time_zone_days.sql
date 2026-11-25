-- Business days in the business's own time zone (ARCH-11, docs/PROJECT_REVIEW_2026-11-17.md).
--
-- Slots, schedules, shifts and finance reports already use businesses.tz. These functions still
-- took the day from a fixed zone:
-- 1. calculate_staff_day_metrics counted a staff member's bookings by the Asia/Bishkek day.
-- 2. apply_promotion_to_booking and can_use_promotion checked valid_from/valid_to against
--    current_date, the UTC date of the database: from 00:00 to 06:00 in Bishkek a promotion
--    ending yesterday still applied and one starting today did not yet.
-- 3. approve_staff_application started the home-branch assignment on the UTC date.
-- 4. get_business/staff_finance_stats_impl_20261109 took "today" (the open shift counted in
--    the stats) as the UTC date.
-- 5. check_booking_branch_match (staff without an explicit schedule) compared the assignment
--    period with the UTC date of the booking start.
-- 6. recalculate_business_hourly_load bucketed hours by b.tz, which gave NULL hours for a
--    business whose tz is NULL; the day bounds already used the default zone.
-- NULL or empty tz means Asia/Bishkek everywhere (the default of businesses.tz). The CHECK
-- businesses_tz_check (DB-16) keeps unknown zones out. For a Bishkek business points 1 and 6
-- change nothing; points 2-5 now use the Bishkek day instead of the UTC day, as the product
-- always meant. Every function keeps its signature, owner and grants (create or replace).
begin;

set local lock_timeout = '5s';

-- Staff rating day: bookings belong to the day of their business calendar.
CREATE OR REPLACE FUNCTION public.calculate_staff_day_metrics(p_staff_id uuid, p_metric_date date)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
    v_config record;
    v_reviews_avg numeric;
    v_reviews_count integer;
    v_clients_count integer;
    v_revenue numeric;
    v_returning_count integer;
    v_returning_ratio numeric;
    v_late_minutes integer;
    v_shifts_with_late integer;
    v_total_shifts integer;
    v_biz_id uuid;
    v_branch_id uuid;
    v_tz text;
    
    -- Компоненты рейтинга
    v_reviews_score numeric;
    v_productivity_score numeric;
    v_loyalty_score numeric;
    v_discipline_score numeric;
    v_day_score numeric;
    
    -- Вспомогательные переменные для расчета дисциплины
    v_late_penalty numeric;
    v_late_ratio numeric;
    v_avg_clients_per_day numeric;
begin
    -- Получаем активную конфигурацию
    select * into v_config
    from public.rating_global_config
    where is_active = true
    order by valid_from desc
    limit 1;
    
    if v_config is null then
        raise exception 'No active rating configuration found';
    end if;
    
    -- Получаем biz_id и branch_id сотрудника
    select biz_id, branch_id into v_biz_id, v_branch_id
    from public.staff
    where id = p_staff_id;
    
    if v_biz_id is null then
        raise exception 'Staff not found or has no business';
    end if;
    v_tz := coalesce((select nullif(btrim(z.tz),'') from public.businesses z where z.id=v_biz_id),'Asia/Bishkek');
    
    -- 1. Метрики отзывов (за день)
    select 
        coalesce(avg(r.rating), 0),
        count(*)::integer
    into v_reviews_avg, v_reviews_count
    from public.reviews r
    join public.bookings b on b.id = r.booking_id
    where b.staff_id = p_staff_id
      and b.status in ('confirmed', 'paid')
      and date(b.start_at at time zone v_tz) = p_metric_date;
    
    -- Нормализуем среднюю оценку в 0-100 (1-5 -> 0-100)
    v_reviews_score := (v_reviews_avg / 5.0) * 100.0;
    
    -- Штраф за отсутствие отзывов (если нет отзывов, но были клиенты)
    -- Буст за большое количество отзывов (если > 5 отзывов за день, небольшой буст)
    if v_reviews_count = 0 then
        v_reviews_score := v_reviews_score * 0.5; -- Штраф 50% если нет отзывов
    elsif v_reviews_count >= 5 then
        v_reviews_score := least(100.0, v_reviews_score * 1.1); -- Буст 10% если много отзывов
    end if;
    
    -- 2. Метрики продуктивности (количество клиентов за день)
    select 
        count(distinct b.client_id)::integer,
        coalesce(sum(ssi.service_amount), 0)
    into v_clients_count, v_revenue
    from public.bookings b
    left join public.staff_shift_items ssi on ssi.booking_id = b.id
    where b.staff_id = p_staff_id
      and b.status in ('confirmed', 'paid')
      and date(b.start_at at time zone v_tz) = p_metric_date;
    
    -- Нормализуем продуктивность: сравниваем со средним по филиалу за последние 30 дней
    select coalesce(avg(clients_count), 0) into v_avg_clients_per_day
    from public.staff_day_metrics
    where branch_id = v_branch_id
      and metric_date >= p_metric_date - interval '30 days'
      and metric_date < p_metric_date;
    
    if v_avg_clients_per_day > 0 then
        -- Если выше среднего - 100, если ниже - пропорционально
        v_productivity_score := least(100.0, (v_clients_count::numeric / v_avg_clients_per_day) * 100.0);
    else
        -- Если нет данных для сравнения, используем абсолютное значение
        -- 0 клиентов = 0, 10+ клиентов = 100
        v_productivity_score := least(100.0, (v_clients_count::numeric / 10.0) * 100.0);
    end if;
    
    -- 3. Метрики возвращаемости (клиенты, которые вернулись 2+ раза)
    with client_visits as (
        select 
            b.client_id,
            count(*) as visit_count
        from public.bookings b
        where b.staff_id = p_staff_id
          and b.status in ('confirmed', 'paid')
          and date(b.start_at at time zone v_tz) <= p_metric_date
        group by b.client_id
    )
    select 
        count(*) filter (where visit_count >= 2)::integer,
        case 
            when count(*) > 0 then 
                (count(*) filter (where visit_count >= 2)::numeric / count(*)::numeric) * 100.0
            else 0
        end
    into v_returning_count, v_returning_ratio
    from client_visits
    where client_id in (
        select distinct client_id
        from public.bookings
        where staff_id = p_staff_id
          and status in ('confirmed', 'paid')
          and date(start_at at time zone v_tz) = p_metric_date
    );
    
    v_loyalty_score := v_returning_ratio; -- Уже в процентах 0-100
    
    -- 4. Метрики дисциплины (опоздания)
    select 
        coalesce(sum(late_minutes), 0)::integer,
        count(*) filter (where late_minutes > 0)::integer,
        count(*)::integer
    into v_late_minutes, v_shifts_with_late, v_total_shifts
    from public.staff_shifts
    where staff_id = p_staff_id
      and shift_date = p_metric_date;
    
    -- Штраф за опоздания: если есть опоздания, снижаем рейтинг
    -- 0 опозданий = 100, каждые 30 минут опоздания = -10 баллов, максимум -50
    if v_total_shifts > 0 then
        v_late_penalty := least(50.0, (v_late_minutes::numeric / 30.0) * 10.0);
        v_discipline_score := 100.0 - v_late_penalty;
        
        -- Дополнительный штраф за процент смен с опозданием
        if v_shifts_with_late > 0 then
            v_late_ratio := (v_shifts_with_late::numeric / v_total_shifts::numeric) * 100.0;
            v_discipline_score := v_discipline_score - (v_late_ratio * 0.3); -- Дополнительный штраф
        end if;
    else
        v_discipline_score := 100.0; -- Если нет смен, считаем идеально
    end if;
    
    -- Ограничиваем все компоненты в диапазоне 0-100
    v_reviews_score := greatest(0, least(100, v_reviews_score));
    v_productivity_score := greatest(0, least(100, v_productivity_score));
    v_loyalty_score := greatest(0, least(100, v_loyalty_score));
    v_discipline_score := greatest(0, least(100, v_discipline_score));
    
    -- Рассчитываем итоговый дневной рейтинг (взвешенное среднее)
    v_day_score := (
        (v_reviews_score * v_config.staff_reviews_weight) +
        (v_productivity_score * v_config.staff_productivity_weight) +
        (v_loyalty_score * v_config.staff_loyalty_weight) +
        (v_discipline_score * v_config.staff_discipline_weight)
    ) / 100.0;
    
    -- Сохраняем или обновляем дневные метрики
    insert into public.staff_day_metrics (
        staff_id, biz_id, branch_id, metric_date,
        avg_rating, reviews_count,
        clients_count, revenue,
        returning_clients_count, returning_clients_ratio,
        late_minutes, shifts_with_late, total_shifts,
        day_score
    ) values (
        p_staff_id, v_biz_id, v_branch_id, p_metric_date,
        v_reviews_avg, v_reviews_count,
        v_clients_count, v_revenue,
        v_returning_count, v_returning_ratio,
        v_late_minutes, v_shifts_with_late, v_total_shifts,
        v_day_score
    )
    on conflict (staff_id, metric_date) do update set
        avg_rating = excluded.avg_rating,
        reviews_count = excluded.reviews_count,
        clients_count = excluded.clients_count,
        revenue = excluded.revenue,
        returning_clients_count = excluded.returning_clients_count,
        returning_clients_ratio = excluded.returning_clients_ratio,
        late_minutes = excluded.late_minutes,
        shifts_with_late = excluded.shifts_with_late,
        total_shifts = excluded.total_shifts,
        day_score = excluded.day_score,
        updated_at = timezone('utc'::text, now());
end;
$function$
;

-- Promotion validity: today of the business, not the UTC date of the database.
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

-- Promotion validity check: today of the business that owns the branch.
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
      and (valid_from is null or valid_from <= (now() at time zone coalesce((select nullif(btrim(z.tz),'') from public.businesses z where z.id=branch_promotions.biz_id),'Asia/Bishkek'))::date)
      and (valid_to is null or valid_to >= (now() at time zone coalesce((select nullif(btrim(z.tz),'') from public.businesses z where z.id=branch_promotions.biz_id),'Asia/Bishkek'))::date);
    
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

-- Approved staff: the home-branch assignment starts on the business day of the approval.
CREATE OR REPLACE FUNCTION public.approve_staff_application(p_application_id uuid, p_reviewer_user_id uuid, p_branch_id uuid, p_is_active boolean DEFAULT true)
 RETURNS TABLE(staff_id uuid, biz_id uuid, branch_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
    v_application public.business_role_applications%rowtype;
    v_role_id uuid;
    v_staff_id uuid;
    v_today date;
begin
    select *
      into v_application
      from public.business_role_applications
     where id = p_application_id
     for update;

    if not found then
        raise exception using errcode = 'P0002', message = 'application_not_found';
    end if;
    v_today := (now() at time zone coalesce((select nullif(btrim(z.tz),'') from public.businesses z where z.id=v_application.biz_id),'Asia/Bishkek'))::date;

    if v_application.status <> 'pending' then
        raise exception using errcode = '23505', message = 'application_already_processed';
    end if;

    if v_application.requested_role <> 'staff' then
        raise exception using errcode = '22023', message = 'application_is_not_staff';
    end if;

    if not exists (
        select 1
          from public.branches b
         where b.id = p_branch_id
           and b.biz_id = v_application.biz_id
           and coalesce(b.is_active, true)
    ) then
        raise exception using errcode = '22023', message = 'invalid_or_inactive_branch';
    end if;

    select r.id
      into v_role_id
      from public.roles r
     where r.key = 'staff'
     limit 1;

    if v_role_id is null then
        raise exception using errcode = 'P0002', message = 'staff_role_not_found';
    end if;

    select s.id
      into v_staff_id
      from public.staff s
     where s.user_id = v_application.applicant_user_id
       and s.biz_id = v_application.biz_id
     for update;

    if v_staff_id is null then
        insert into public.staff (
            user_id,
            biz_id,
            branch_id,
            full_name,
            email,
            phone,
            is_active
        ) values (
            v_application.applicant_user_id,
            v_application.biz_id,
            p_branch_id,
            coalesce(
                nullif(btrim(v_application.applicant_name), ''),
                nullif(btrim(v_application.applicant_email), ''),
                nullif(btrim(v_application.applicant_phone), ''),
                'Сотрудник'
            ),
            v_application.applicant_email,
            v_application.applicant_phone,
            p_is_active
        )
        returning id into v_staff_id;
    else
        update public.staff
           set branch_id = p_branch_id,
               is_active = p_is_active,
               email = coalesce(email, v_application.applicant_email),
               phone = coalesce(phone, v_application.applicant_phone)
         where id = v_staff_id;
    end if;

    insert into public.user_roles (user_id, role_id, biz_id)
    select v_application.applicant_user_id, v_role_id, v_application.biz_id
     where not exists (
        select 1
          from public.user_roles ur
         where ur.user_id = v_application.applicant_user_id
           and ur.role_id = v_role_id
           and ur.biz_id = v_application.biz_id
    );

    insert into public.staff_branch_assignments (
        biz_id,
        staff_id,
        branch_id,
        valid_from
    )
    select v_application.biz_id, v_staff_id, p_branch_id, v_today
     where not exists (
        select 1
          from public.staff_branch_assignments sba
         where sba.biz_id = v_application.biz_id
           and sba.staff_id = v_staff_id
           and sba.branch_id = p_branch_id
           and sba.valid_to is null
    );

    update public.business_role_applications
       set status = 'approved',
           reviewed_at = now(),
           reviewed_by = p_reviewer_user_id,
           review_note = null,
           updated_at = now()
     where id = p_application_id;

    return query
    select v_staff_id, v_application.biz_id, p_branch_id;
end;
$function$
;

-- Business finance stats: today of the business.
CREATE OR REPLACE FUNCTION public.get_business_finance_stats_impl_20261109(p_biz_id uuid, p_date_from date, p_date_to date, p_branch_id uuid DEFAULT NULL::uuid, p_include_open boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result jsonb;
    v_today date;
BEGIN
    v_today := (statement_timestamp() at time zone public.finance_business_timezone(p_biz_id))::date;
    
    -- Сначала получаем статистику по каждому сотруднику
    WITH staff_data AS (
        SELECT 
            st.id AS staff_id,
            st.full_name AS staff_name,
            st.is_active,
            st.branch_id,
            COUNT(s.id) AS total_shifts,
            COUNT(*) FILTER (WHERE s.status = 'closed') AS closed_shifts,
            COUNT(*) FILTER (WHERE s.status = 'open') AS open_shifts,
            COALESCE(SUM(s.total_amount) FILTER (WHERE s.status = 'closed'), 0) AS total_amount,
            COALESCE(SUM(s.master_share) FILTER (WHERE s.status = 'closed'), 0) AS total_master,
            COALESCE(SUM(s.salon_share) FILTER (WHERE s.status = 'closed'), 0) AS total_salon,
            COALESCE(SUM(s.consumables_amount) FILTER (WHERE s.status = 'closed'), 0) AS total_consumables,
            COALESCE(SUM(s.late_minutes) FILTER (WHERE s.status = 'closed'), 0) AS total_late_minutes
        FROM public.staff st
        LEFT JOIN public.staff_shifts s ON s.staff_id = st.id
            AND s.biz_id = p_biz_id
            AND s.shift_date >= p_date_from
            AND s.shift_date <= p_date_to
        WHERE st.biz_id = p_biz_id
          AND (p_branch_id IS NULL OR st.branch_id = p_branch_id)
        GROUP BY st.id, st.full_name, st.is_active, st.branch_id
    ),
    staff_stats_json AS (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'staff_id', sd.staff_id,
                'staff_name', sd.staff_name,
                'is_active', sd.is_active,
                'branch_id', sd.branch_id,
                'shifts', jsonb_build_object(
                    'total', sd.total_shifts,
                    'closed', sd.closed_shifts,
                    'open', sd.open_shifts
                ),
                'stats', jsonb_build_object(
                    'total_amount', sd.total_amount,
                    'total_master', sd.total_master,
                    'total_salon', sd.total_salon,
                    'total_consumables', sd.total_consumables,
                    'total_late_minutes', sd.total_late_minutes
                )
            )
            ORDER BY sd.staff_name
        ), '[]'::jsonb) AS staff_stats
        FROM staff_data sd
    ),
    total_data AS (
        SELECT 
            COUNT(s.id) AS total_shifts,
            COUNT(*) FILTER (WHERE s.status = 'closed') AS closed_shifts,
            COUNT(*) FILTER (WHERE s.status = 'open') AS open_shifts,
            COALESCE(SUM(s.total_amount) FILTER (WHERE s.status = 'closed'), 0) AS total_amount,
            COALESCE(SUM(s.master_share) FILTER (WHERE s.status = 'closed'), 0) AS total_master,
            COALESCE(SUM(s.salon_share) FILTER (WHERE s.status = 'closed'), 0) AS total_salon,
            COALESCE(SUM(s.consumables_amount) FILTER (WHERE s.status = 'closed'), 0) AS total_consumables,
            COALESCE(SUM(s.late_minutes) FILTER (WHERE s.status = 'closed'), 0) AS total_late_minutes
        FROM public.staff st
        LEFT JOIN public.staff_shifts s ON s.staff_id = st.id
            AND s.biz_id = p_biz_id
            AND s.shift_date >= p_date_from
            AND s.shift_date <= p_date_to
        WHERE st.biz_id = p_biz_id
          AND (p_branch_id IS NULL OR st.branch_id = p_branch_id)
    )
    SELECT jsonb_build_object(
        'staff_stats', ssj.staff_stats,
        'total_stats', jsonb_build_object(
            'total_shifts', td.total_shifts,
            'closed_shifts', td.closed_shifts,
            'open_shifts', td.open_shifts,
            'total_amount', td.total_amount,
            'total_master', td.total_master,
            'total_salon', td.total_salon,
            'total_consumables', td.total_consumables,
            'total_late_minutes', td.total_late_minutes
        )
    )
    INTO v_result
    FROM staff_stats_json ssj
    CROSS JOIN total_data td;
    
    -- Если нужно включить открытые смены, добавляем их расчеты
    IF p_include_open THEN
        -- Для открытых смен нужно считать из позиций
        -- Это делается отдельно, так как требует JOIN с staff_shift_items
        -- Пока оставляем это на стороне API для гибкости
    END IF;
    
    RETURN v_result;
END;
$function$
;

-- Staff finance stats: today of the business.
CREATE OR REPLACE FUNCTION public.get_staff_finance_stats_impl_20261109(p_staff_id uuid, p_biz_id uuid, p_date_from date, p_date_to date, p_include_open boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
    v_result jsonb;
    v_today date;
    v_open_shift_id uuid;
    v_open_shift_data jsonb;
begin
    v_today := (statement_timestamp() at time zone public.finance_business_timezone(p_biz_id))::date;
    
    -- Получаем закрытые смены за период
    select jsonb_build_object(
        'closed_shifts', coalesce(jsonb_agg(
            jsonb_build_object(
                'id', s.id,
                'shift_date', s.shift_date,
                'status', s.status,
                'opened_at', s.opened_at,
                'closed_at', s.closed_at,
                'total_amount', s.total_amount,
                'consumables_amount', s.consumables_amount,
                'master_share', s.master_share,
                'salon_share', s.salon_share,
                'late_minutes', s.late_minutes,
                'hours_worked', s.hours_worked,
                'hourly_rate', s.hourly_rate,
                'guaranteed_amount', s.guaranteed_amount,
                'topup_amount', s.topup_amount,
                'items_count', (
                    select count(*)
                    from public.staff_shift_items
                    where shift_id = s.id
                )
            )
            order by s.shift_date desc
        ), '[]'::jsonb),
        'closed_stats', jsonb_build_object(
            'count', count(*),
            'total_amount', coalesce(sum(s.total_amount), 0),
            'total_master', coalesce(sum(s.master_share), 0),
            'total_salon', coalesce(sum(s.salon_share), 0),
            'total_consumables', coalesce(sum(s.consumables_amount), 0),
            'total_late_minutes', coalesce(sum(s.late_minutes), 0)
        )
    )
    into v_result
    from public.staff_shifts s
    where s.staff_id = p_staff_id
      and s.biz_id = p_biz_id
      and s.status = 'closed'
      and s.shift_date >= p_date_from
      and s.shift_date <= p_date_to;
    
    -- Если нужно включить открытые смены
    if p_include_open then
        -- Проверяем, есть ли открытая смена на сегодня
        select id
        into v_open_shift_id
        from public.staff_shifts
        where staff_id = p_staff_id
          and biz_id = p_biz_id
          and shift_date = v_today
          and status = 'open'
        limit 1;
        
        if v_open_shift_id is not null then
            -- Получаем данные открытой смены с агрегацией позиций
            select jsonb_build_object(
                'id', s.id,
                'shift_date', s.shift_date,
                'status', s.status,
                'opened_at', s.opened_at,
                'closed_at', s.closed_at,
                'late_minutes', s.late_minutes,
                'hourly_rate', coalesce(s.hourly_rate, st.hourly_rate),
                'percent_master', coalesce(s.percent_master, st.percent_master, 60),
                'percent_salon', coalesce(s.percent_salon, st.percent_salon, 40),
                'items', coalesce(
                    jsonb_agg(
                        jsonb_build_object(
                            'id', si.id,
                            'client_name', si.client_name,
                            'service_name', si.service_name,
                            'service_amount', si.service_amount,
                            'consumables_amount', si.consumables_amount,
                            'note', si.note,
                            'booking_id', si.booking_id
                        )
                        order by si.created_at
                    ) filter (where si.id is not null),
                    '[]'::jsonb
                ),
                'calculated', jsonb_build_object(
                    'total_amount', coalesce(sum(si.service_amount), 0),
                    'total_consumables', coalesce(sum(si.consumables_amount), 0),
                    'items_count', count(si.id)
                )
            )
            into v_open_shift_data
            from public.staff_shifts s
            left join public.staff st on st.id = s.staff_id
            left join public.staff_shift_items si on si.shift_id = s.id
            where s.id = v_open_shift_id
            group by s.id, s.shift_date, s.status, s.opened_at, s.closed_at, 
                     s.late_minutes, s.hourly_rate, s.percent_master, s.percent_salon,
                     st.hourly_rate, st.percent_master, st.percent_salon;
            
            -- Добавляем открытую смену в результат
            v_result := v_result || jsonb_build_object(
                'open_shift', v_open_shift_data,
                'has_open_shift', true
            );
        else
            v_result := v_result || jsonb_build_object(
                'open_shift', null,
                'has_open_shift', false
            );
        end if;
    end if;
    
    return v_result;
end;
$function$
;

-- Legacy branch assignment check: the booking day of the business calendar, not the UTC date.
CREATE OR REPLACE FUNCTION public.check_booking_branch_match()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_date date;
    v_exists_in_assignments boolean;
    v_exists_in_schedule_rules boolean;
begin
    -- Explicit schedules determine the work location, without duplicate assignments.
    if exists(select 1 from public.staff_schedule_versions where staff_id=NEW.staff_id) then
        -- check_explicit_schedule_booking owns validation and locking. Do not
        -- revalidate historical bookings on unrelated financial/status updates.
        return NEW;
    end if;
    -- Дата брони
    v_date := (NEW.start_at at time zone coalesce((select nullif(btrim(z.tz),'') from public.businesses z where z.id=NEW.biz_id),'Asia/Bishkek'))::date;

    -- Проверяем, что в истории назначений есть запись для этого мастера,
    -- филиала и бизнеса, перекрывающая дату брони.
    select exists (
        select 1
        from public.staff_branch_assignments sba
        where sba.staff_id = NEW.staff_id
          and sba.branch_id = NEW.branch_id
          and sba.biz_id = NEW.biz_id
          and sba.valid_from <= v_date
          and (sba.valid_to is null or sba.valid_to >= v_date)
    )
    into v_exists_in_assignments;

    -- Также проверяем временные переводы через staff_schedule_rules
    select exists (
        select 1
        from public.staff_schedule_rules ssr
        where ssr.staff_id = NEW.staff_id
          and ssr.branch_id = NEW.branch_id
          and ssr.biz_id = NEW.biz_id
          and ssr.kind = 'date'
          and ssr.date_on = v_date
          and ssr.is_active = true
    )
    into v_exists_in_schedule_rules;

    -- Если нет ни в assignments, ни в schedule_rules - ошибка
    if not v_exists_in_assignments and not v_exists_in_schedule_rules then
        raise exception
            'Staff % is not assigned to branch % on date %',
            NEW.staff_id, NEW.branch_id, v_date
            using errcode = '22023';
    end if;

    return NEW;
end;
$function$
;

-- Hourly load: the hour in the same zone as the day bounds (a NULL tz gave NULL hours).
CREATE OR REPLACE FUNCTION public.recalculate_business_hourly_load(p_date date, p_default_tz text DEFAULT 'Asia/Bishkek'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
        select b.id as biz_id,k.branch_id,p_date as date,extract(hour from k.start_at at time zone coalesce(nullif(btrim(b.tz),''),p_default_tz))::integer as hour,
            count(*) as bookings_count,count(*) filter(where coalesce(k.promotion_applied->>'promotion_type','')<>'') as promo_bookings_count,
            nullif(count(distinct k.staff_id),0) as staff_count,nullif(count(distinct k.client_id),0) as unique_clients_count
        from bounds b join public.bookings k on k.biz_id=b.id and k.start_at>=b.starts_at and k.start_at<b.ends_at
            and k.status in ('confirmed','paid') and k.branch_id is not null
        group by b.id,k.branch_id,extract(hour from k.start_at at time zone coalesce(nullif(btrim(b.tz),''),p_default_tz))
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
$function$
;

commit;
