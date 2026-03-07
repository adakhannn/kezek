-- Логика выбора применимого пакета визитов и списание при переходе брони в paid.
-- Пакет имеет приоритет над промоакцией. См. docs/SUBSCRIPTIONS_AND_PACKAGES_FEATURE.md

-- Возвращает id подходящего client_visit_packages для бронирования (или null).
-- Условия: бронь с client_id, branch_id, service_id; пакет активен (remaining_visits > 0, valid_until >= today);
-- план подходит по услуге (service_id null или совпадает) и по филиалу (branch_ids null/пустой или branch_id в списке);
-- бронирование ещё не использовало пакет (нет записи в client_visit_package_uses).
-- Приоритет: сначала с истекающим сроком (valid_until ASC).
create or replace function public.get_applicable_visit_package_for_booking(p_booking_id uuid)
returns uuid
language plpgsql
security definer
stable
as $$
declare
    v_booking record;
    v_cvp_id uuid;
begin
    select b.id, b.client_id, b.branch_id, b.service_id, b.status
    into v_booking
    from public.bookings b
    where b.id = p_booking_id;

    if v_booking is null or v_booking.client_id is null then
        return null;
    end if;

    if v_booking.status != 'paid' then
        return null;
    end if;

    -- Уже списано по этому бронированию
    if exists (select 1 from public.client_visit_package_uses where booking_id = p_booking_id) then
        return null;
    end if;

    select cvp.id into v_cvp_id
    from public.client_visit_packages cvp
    join public.visit_package_plans p on p.id = cvp.plan_id
    where cvp.client_id = v_booking.client_id
      and cvp.remaining_visits > 0
      and cvp.valid_until >= current_date
      and p.is_active = true
      and (p.service_id is null or p.service_id = v_booking.service_id)
      and (p.branch_ids is null or array_length(p.branch_ids, 1) is null or v_booking.branch_id = any(p.branch_ids))
    order by cvp.valid_until asc
    limit 1;

    return v_cvp_id;
end;
$$;

comment on function public.get_applicable_visit_package_for_booking(uuid) is 'Возвращает id подходящего пакета визитов для бронирования (приоритет: с истекающим сроком).';

-- Применяет пакет к бронированию: списывает один визит, записывает использование, обновляет subscription_applied.
-- Вызывать только для брони со статусом paid и с client_id. Возвращает jsonb с applied, plan_id, plan_name_ru, final_amount, remaining_after.
create or replace function public.apply_visit_package_to_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
as $$
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

    select coalesce(
        (select (s.price_from + s.price_to) / 2 from public.services s where s.id = v_booking.service_id),
        (select s.price_from from public.services s where s.id = v_booking.service_id),
        0
    ) into v_base_price;

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
$$;

comment on function public.apply_visit_package_to_booking(uuid) is 'Списывает один визит с пакета по бронированию, записывает использование и subscription_applied. Пакет имеет приоритет над промо.';

-- Ветка paid: сначала пробуем пакет визитов, затем промоакцию.
create or replace function public.update_booking_status_with_promotion(
    p_booking_id uuid,
    p_new_status booking_status
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_package_result jsonb;
    v_promotion_result jsonb;
begin
    perform public.update_booking_status_no_check(p_booking_id, p_new_status);

    if p_new_status = 'paid' then
        v_package_result := public.apply_visit_package_to_booking(p_booking_id);
        if (v_package_result->>'applied') = 'true' then
            return v_package_result;
        end if;

        v_promotion_result := public.apply_promotion_to_booking(p_booking_id);
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
        return coalesce(v_promotion_result, jsonb_build_object('applied', false, 'reason', 'No promotion applied'));
    end if;

    return jsonb_build_object('applied', false, 'reason', 'Status is not paid');
end;
$$;

comment on function public.update_booking_status_with_promotion(uuid, booking_status) is 'Обновляет статус бронирования. При paid: сначала пакет визитов, затем промоакция.';
