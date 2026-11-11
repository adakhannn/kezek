-- Actor/tenant guards for exposed financial RPCs. Apply only with the application release.
-- Existing migration history is intentionally unchanged.
begin;

create or replace function public.finance_can_manage_business(p_actor_id uuid, p_biz_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public as $$
    select p_actor_id is not null and (
        exists(select 1 from public.businesses b where b.id=p_biz_id and b.owner_id=p_actor_id)
        or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
            where ur.user_id=p_actor_id and ((ur.biz_id=p_biz_id and r.key in ('owner','admin','manager'))
                or (ur.biz_id is null and r.key='super_admin')))
    );
$$;
revoke all on function public.finance_can_manage_business(uuid,uuid) from public, anon, authenticated;

create or replace function public.assert_finance_access(p_biz_id uuid, p_staff_id uuid default null, p_actor_id uuid default null)
returns void language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare v_actor uuid;
begin
    -- Only a trusted service caller may supply an actor. User RPCs always use their JWT identity.
    v_actor := case when auth.role()='service_role' then p_actor_id else auth.uid() end;
    if p_biz_id is null or not exists(select 1 from public.businesses where id=p_biz_id) then
        raise exception using errcode='42501', message='FINANCE_FORBIDDEN';
    end if;
    if p_staff_id is not null and not exists(select 1 from public.staff where id=p_staff_id and biz_id=p_biz_id) then
        raise exception using errcode='42501', message='FINANCE_FORBIDDEN';
    end if;
    if auth.role()='service_role' and p_actor_id is null then return; end if;
    if public.finance_can_manage_business(v_actor,p_biz_id) then return; end if;
    if p_staff_id is not null and exists(select 1 from public.staff
        where id=p_staff_id and biz_id=p_biz_id and user_id=v_actor and is_active=true) then return; end if;
    raise exception using errcode='42501', message='FINANCE_FORBIDDEN';
end;
$$;
revoke all on function public.assert_finance_access(uuid,uuid,uuid) from public, anon, authenticated;

create or replace function public.assert_booking_finance_access(p_booking_id uuid)
returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_booking record;
begin
    select biz_id,staff_id into v_booking from public.bookings where id=p_booking_id;
    if not found then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    perform public.assert_finance_access(v_booking.biz_id,v_booking.staff_id);
end;
$$;
revoke all on function public.assert_booking_finance_access(uuid) from public,anon,authenticated;

create or replace function public.update_booking_status_no_check(p_booking_id uuid,p_new_status public.booking_status)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_booking record;
begin
    select * into v_booking from public.bookings where id=p_booking_id for update;
    if not found then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    -- A client may cancel their own pending booking, but cannot mark attendance or charge a package.
    if not (auth.uid() is not null and v_booking.client_id=auth.uid()
        and p_new_status='cancelled' and v_booking.status in ('hold','confirmed')) then
        perform public.assert_finance_access(v_booking.biz_id,v_booking.staff_id);
    end if;
    update public.bookings set status=p_new_status where id=p_booking_id;
end;
$$;
revoke all on function public.update_booking_status_no_check(uuid,public.booking_status) from public,anon;
grant execute on function public.update_booking_status_no_check(uuid,public.booking_status) to authenticated,service_role;

-- Preserve the audited query implementations behind checked entry points; old names are not public RPCs.
alter function public.get_business_finance_stats(uuid,date,date,uuid,boolean) rename to get_business_finance_stats_impl_20261109;
revoke all on function public.get_business_finance_stats_impl_20261109(uuid,date,date,uuid,boolean) from public,anon,authenticated;
create function public.get_business_finance_stats(p_biz_id uuid,p_date_from date,p_date_to date,p_branch_id uuid default null,p_include_open boolean default true)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
    perform public.assert_finance_access(p_biz_id);
    if p_branch_id is not null and not exists(select 1 from public.branches where id=p_branch_id and biz_id=p_biz_id) then
        raise exception using errcode='42501',message='FINANCE_FORBIDDEN';
    end if;
    return public.get_business_finance_stats_impl_20261109(p_biz_id,p_date_from,p_date_to,p_branch_id,p_include_open);
end;
$$;
revoke all on function public.get_business_finance_stats(uuid,date,date,uuid,boolean) from public,anon;
grant execute on function public.get_business_finance_stats(uuid,date,date,uuid,boolean) to authenticated,service_role;


alter function public.get_staff_finance_stats(uuid,uuid,date,date,boolean) rename to get_staff_finance_stats_impl_20261109;
revoke all on function public.get_staff_finance_stats_impl_20261109(uuid,uuid,date,date,boolean) from public,anon,authenticated;
create function public.get_staff_finance_stats(p_staff_id uuid,p_biz_id uuid,p_date_from date,p_date_to date,p_include_open boolean default true)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
    perform public.assert_finance_access(p_biz_id,p_staff_id);
    return public.get_staff_finance_stats_impl_20261109(p_staff_id,p_biz_id,p_date_from,p_date_to,p_include_open);
end;
$$;
revoke all on function public.get_staff_finance_stats(uuid,uuid,date,date,boolean) from public,anon;
grant execute on function public.get_staff_finance_stats(uuid,uuid,date,date,boolean) to authenticated,service_role;

-- This obsolete replacement writer has no application callers. The new command below owns validation and totals.
revoke all on function public.save_shift_items_atomic(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_shift_items_atomic(uuid,jsonb) to service_role;

create or replace function public.get_applicable_visit_package_for_booking(p_booking_id uuid)
returns uuid language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_booking record; v_package_id uuid;
begin
    perform public.assert_booking_finance_access(p_booking_id);
    select id,biz_id,client_id,branch_id,service_id,status into v_booking from public.bookings where id=p_booking_id;
    if v_booking.client_id is null or v_booking.status<>'paid'
        or exists(select 1 from public.client_visit_package_uses where booking_id=p_booking_id) then return null; end if;
    select cvp.id into v_package_id
    from public.client_visit_packages cvp join public.visit_package_plans p on p.id=cvp.plan_id
    where cvp.client_id=v_booking.client_id and p.biz_id=v_booking.biz_id
        and cvp.remaining_visits>0 and cvp.valid_until>=current_date and p.is_active=true
        and (p.service_id is null or p.service_id=v_booking.service_id)
        and (p.branch_ids is null or array_length(p.branch_ids,1) is null or v_booking.branch_id=any(p.branch_ids))
    order by cvp.valid_until,cvp.id limit 1;
    return v_package_id;
end;
$$;
revoke all on function public.get_applicable_visit_package_for_booking(uuid) from public,anon;
grant execute on function public.get_applicable_visit_package_for_booking(uuid) to authenticated,service_role;

alter function public.apply_visit_package_to_booking(uuid) rename to apply_visit_package_to_booking_impl_20261109;
revoke all on function public.apply_visit_package_to_booking_impl_20261109(uuid) from public,anon,authenticated;
create function public.apply_visit_package_to_booking(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_booking public.bookings%rowtype; v_existing jsonb;
begin
    -- Every debit for the same booking serializes here, including direct RPC retries.
    select * into v_booking from public.bookings where id=p_booking_id for update;
    if not found then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    perform public.assert_finance_access(v_booking.biz_id,v_booking.staff_id);
    v_existing:=v_booking.subscription_applied;
    if exists(select 1 from public.client_visit_package_uses where booking_id=p_booking_id) then
        return jsonb_build_object('applied',true)||coalesce(v_existing,'{}'::jsonb);
    end if;
    return public.apply_visit_package_to_booking_impl_20261109(p_booking_id);
end;
$$;
revoke all on function public.apply_visit_package_to_booking(uuid) from public,anon;
grant execute on function public.apply_visit_package_to_booking(uuid) to authenticated,service_role;

alter function public.apply_promotion_to_booking(uuid) rename to apply_promotion_to_booking_impl_20261109;
revoke all on function public.apply_promotion_to_booking_impl_20261109(uuid) from public,anon,authenticated;
create or replace function public.apply_promotion_to_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
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
        and public.can_use_promotion(v_client_id,v_branch_id,p.id);
    
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
$$;
revoke all on function public.apply_promotion_to_booking(uuid) from public,anon;
grant execute on function public.apply_promotion_to_booking(uuid) to authenticated,service_role;

create or replace function public.update_booking_status_with_promotion(p_booking_id uuid,p_new_status public.booking_status)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_booking record; v_result jsonb;
begin
    select * into v_booking from public.bookings where id=p_booking_id for update;
    if not found then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    perform public.assert_finance_access(v_booking.biz_id,v_booking.staff_id);
    if p_new_status='paid' and v_booking.status='paid' then
        return jsonb_build_object('applied',v_booking.subscription_applied is not null or v_booking.promotion_applied is not null,
            'already_paid',true)||coalesce(v_booking.subscription_applied,v_booking.promotion_applied,'{}'::jsonb);
    end if;
    perform public.update_booking_status_no_check(p_booking_id,p_new_status);
    if p_new_status<>'paid' then return jsonb_build_object('applied',false,'reason','Status is not paid'); end if;
    v_result:=public.apply_visit_package_to_booking(p_booking_id);
    if v_result->>'applied'='true' then return v_result; end if;
    -- A failed concurrent package debit is an operational failure, not permission to grant another benefit.
    if v_result->>'reason'='Package visit count race' then
        raise exception using errcode='40001',message='PACKAGE_CHANGED';
    end if;
    v_result:=public.apply_promotion_to_booking(p_booking_id);
    if v_result ? 'error' then raise exception using errcode='P0001',message='PROMOTION_APPLICATION_FAILED'; end if;
    if v_result->>'applied'='true' then
        update public.bookings set promotion_applied=jsonb_build_object(
            'promotion_id',v_result->>'promotion_id','promotion_type',v_result->>'promotion_type',
            'promotion_title',v_result->>'promotion_title','original_amount',(v_result->>'original_amount')::numeric,
            'final_amount',(v_result->>'final_amount')::numeric,'discount_percent',(v_result->>'discount_percent')::numeric,
            'discount_amount',(v_result->>'discount_amount')::numeric,'applied_at',now()) where id=p_booking_id;
    end if;
    return coalesce(v_result,jsonb_build_object('applied',false));
end;
$$;
revoke all on function public.update_booking_status_with_promotion(uuid,public.booking_status) from public,anon;
grant execute on function public.update_booking_status_with_promotion(uuid,public.booking_status) to authenticated,service_role;
commit;
