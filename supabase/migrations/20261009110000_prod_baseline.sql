-- Production schema baseline (squash).
--
-- Source: `supabase db dump` (schema only, no data) of project kezek taken
-- 2026-11-16. The production migration history then ended at 20261009110000.
-- It replaces the 138 earlier migration files, kept for reference in
-- supabase/migrations_archive/ (they could not bootstrap a clean database:
-- the original tables, booking_status and is_super_admin() were created
-- outside version control). Includes 20260731010000 (applied in production
-- as 20260731082333) and 20261015075000 (applied manually, no history row).
--
-- Supabase-managed schemas (auth, storage, realtime, vault, ...) and role
-- settings are not part of this file; the local stack provides them.
-- Do not edit: schema changes go into new migrations after this version.



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."booking_status" AS ENUM (
    'hold',
    'confirmed',
    'paid',
    'cancelled',
    'no_show'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."promotion_type" AS ENUM (
    'free_after_n_visits',
    'referral_free',
    'referral_discount_50',
    'birthday_discount',
    'first_visit_discount'
);


ALTER TYPE "public"."promotion_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."promotion_type" IS 'Тип акции филиала';



CREATE TYPE "public"."schedule_rule_kind" AS ENUM (
    'weekly',
    'date',
    'range'
);


ALTER TYPE "public"."schedule_rule_kind" OWNER TO "postgres";


CREATE TYPE "public"."visit_package_discount_type" AS ENUM (
    'percent',
    'fixed_price'
);


ALTER TYPE "public"."visit_package_discount_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."visit_package_discount_type" IS 'Тип применения цены по пакету визитов';



CREATE OR REPLACE FUNCTION "public"."anonymize_inactive_profiles_pii"("p_inactive_days" integer DEFAULT 1095) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_updated_count integer;
    v_cutoff timestamptz;
begin
    v_cutoff := timezone('utc'::text, now()) - (p_inactive_days || ' days')::interval;

    with inactive as (
        select p.id
        from public.profiles p
        join auth.users u on u.id = p.id
        where (p.full_name is not null or p.phone is not null)
          -- Account age and the latest successful sign-in are both activity.
          and u.created_at < v_cutoff
          and coalesce(u.last_sign_in_at, u.created_at) < v_cutoff
          -- Operational accounts remain identifiable while they hold access.
          and not exists (
              select 1
              from public.staff s
              where s.user_id = p.id
          )
          and not exists (
              select 1
              from public.businesses b
              where b.owner_id = p.id
          )
          and not exists (
              select 1
              from public.user_roles ur
              where ur.user_id = p.id
          )
          and not exists (
              select 1
              from public.user_global_roles ugr
              where ugr.user_id = p.id
          )
          and not exists (
              select 1
              from public.bookings b
              where b.client_id = p.id
                and b.start_at >= v_cutoff
          )
    )
    update public.profiles
    set full_name = 'Anonymized',
        phone = null
    from inactive
    where profiles.id = inactive.id;

    get diagnostics v_updated_count = row_count;
    return v_updated_count;
end;
$$;


ALTER FUNCTION "public"."anonymize_inactive_profiles_pii"("p_inactive_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."anonymize_inactive_profiles_pii"("p_inactive_days" integer) IS 'Anonymizes client profile PII only after the account, latest sign-in, and latest booking have all been inactive for the configured period; operational role accounts are excluded.';



CREATE OR REPLACE FUNCTION "public"."anonymize_old_bookings_pii"("p_older_than_days" integer DEFAULT 2555) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_updated_count integer;
begin
    update public.bookings
    set
        client_name = case when trim(coalesce(client_name, '')) <> '' then 'Anonymized' else client_name end,
        client_phone = null,
        client_email = null
    where start_at < timezone('utc'::text, now()) - (p_older_than_days || ' days')::interval
      and (client_name is not null or client_phone is not null or client_email is not null);
    get diagnostics v_updated_count = row_count;
    return v_updated_count;
end;
$$;


ALTER FUNCTION "public"."anonymize_old_bookings_pii"("p_older_than_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."anonymize_old_bookings_pii"("p_older_than_days" integer) IS 'Анонимизирует client_name, client_phone, client_email в бронях старше указанного количества дней (по умолчанию 7 лет = 2555).';



CREATE OR REPLACE FUNCTION "public"."apply_promotion_to_booking"("p_booking_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
    
    -- Получаем все активные акции для этого филиала
    select array_agg(p.*) into v_promotions
    from public.branch_promotions p
    where p.branch_id = v_branch_id
      and p.is_active = true
      and (p.valid_from is null or p.valid_from <= CURRENT_DATE)
      and (p.valid_to is null or p.valid_to >= CURRENT_DATE)
      and (
          -- Для first_visit_discount и birthday_discount - проверяем сразу
          p.promotion_type in ('first_visit_discount', 'birthday_discount')
          -- Для остальных - проверяем через can_use_promotion
          or public.can_use_promotion(v_client_id, v_branch_id, p.id)
      )
    order by 
        -- Приоритет: бесплатная услуга > скидка 50% > скидка < 50%
        case p.promotion_type
            when 'free_after_n_visits' then 1
            when 'referral_free' then 2
            when 'referral_discount_50' then 3
            when 'first_visit_discount' then 4
            when 'birthday_discount' then 5
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


ALTER FUNCTION "public"."apply_promotion_to_booking"("p_booking_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_promotion_to_booking"("p_booking_id" "uuid") IS 'Применяет акцию к бронированию при отметке как paid. Возвращает JSON с информацией о примененной акции.';



CREATE OR REPLACE FUNCTION "public"."apply_registration_links_to_first_branch"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    submitted_links jsonb;
begin
    if coalesce(new.directory_links, '{}'::jsonb) <> '{}'::jsonb then
        return new;
    end if;

    if exists (select 1 from public.branches where biz_id = new.biz_id) then
        return new;
    end if;

    select coalesce(directory_links, '{}'::jsonb)
      into submitted_links
      from public.business_registration_applications
     where created_business_id = new.biz_id
       and jsonb_typeof(directory_links) = 'object'
       and directory_links <> '{}'::jsonb
     order by created_at asc
     limit 1;

    if submitted_links is not null and submitted_links <> '{}'::jsonb then
        new.directory_links := submitted_links;
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."apply_registration_links_to_first_branch"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_visit_package_to_booking"("p_booking_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."apply_visit_package_to_booking"("p_booking_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_visit_package_to_booking"("p_booking_id" "uuid") IS 'Списывает один визит с пакета по бронированию, записывает использование и subscription_applied. Пакет имеет приоритет над промо.';



CREATE OR REPLACE FUNCTION "public"."approve_staff_application"("p_application_id" "uuid", "p_reviewer_user_id" "uuid", "p_branch_id" "uuid", "p_is_active" boolean DEFAULT true) RETURNS TABLE("staff_id" "uuid", "biz_id" "uuid", "branch_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
    v_application public.business_role_applications%rowtype;
    v_role_id uuid;
    v_staff_id uuid;
    v_today date := current_date;
begin
    select *
      into v_application
      from public.business_role_applications
     where id = p_application_id
     for update;

    if not found then
        raise exception using errcode = 'P0002', message = 'application_not_found';
    end if;

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
$$;


ALTER FUNCTION "public"."approve_staff_application"("p_application_id" "uuid", "p_reviewer_user_id" "uuid", "p_branch_id" "uuid", "p_is_active" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."approve_staff_application"("p_application_id" "uuid", "p_reviewer_user_id" "uuid", "p_branch_id" "uuid", "p_is_active" boolean) IS 'Atomically approves a staff application and creates or links the staff card, role, and active branch assignment.';



CREATE OR REPLACE FUNCTION "public"."assign_business_owner"("p_biz_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_owner_role_id uuid;
begin
  -- 1) запрет назначения заблокированного пользователя
  if exists (select 1 from public.user_suspensions s where s.user_id = p_user_id) then
    raise exception 'USER_SUSPENDED';
  end if;

  -- 2) запрет владения более чем одним бизнесом
  if exists (
    select 1 from public.businesses b
     where b.owner_id = p_user_id
       and b.id <> p_biz_id
  ) then
    raise exception 'USER_ALREADY_OWNER_OF_OTHER_BIZ';
  end if;

  -- id роли owner
  select id into v_owner_role_id
  from public.roles
  where key = 'owner'
  limit 1;

  if v_owner_role_id is null then
    raise exception 'ROLE_OWNER_NOT_FOUND';
  end if;

  -- 3) СНАЧАЛА назначаем нового владельца (не оставляем бизнес без владельца)
  update public.businesses
     set owner_id = p_user_id
   where id = p_biz_id;

  -- 4) Гарантируем owner-роль у нового владельца в этом бизнесе
  insert into public.user_roles(user_id, role_id, biz_id)
  values (p_user_id, v_owner_role_id, p_biz_id)
  on conflict do nothing;

  -- 5) Удаляем owner-роль у всех прочих пользователей этого же бизнеса
  delete from public.user_roles ur
  where ur.biz_id  = p_biz_id
    and ur.role_id = v_owner_role_id
    and ur.user_id <> p_user_id;
end
$$;


ALTER FUNCTION "public"."assign_business_owner"("p_biz_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_business_creation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    insert into public.business_creation_audit_log (
        business_id,
        event_type,
        source,
        actor_user_id,
        application_id,
        metadata,
        created_at
    )
    values (
        new.id,
        'created',
        new.creation_source,
        new.created_by_user_id,
        new.source_application_id,
        jsonb_build_object(
            'name', new.name,
            'slug', new.slug,
            'categories', coalesce(to_jsonb(new.categories), '[]'::jsonb),
            'branch_limit', new.branch_limit
        ),
        coalesce(new.created_at, now())
    );
    return new;
end;
$$;


ALTER FUNCTION "public"."audit_business_creation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."booking_receipt_public"("p_id" "uuid") RETURNS TABLE("id" "uuid", "status" "public"."booking_status", "start_at" timestamp with time zone, "end_at" timestamp with time zone, "staff_name" "text", "services" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select b.id, b.status, b.start_at, b.end_at, st.full_name,
    case when exists(select 1 from public.booking_services bs where bs.booking_id=b.id)
      then (select jsonb_agg(jsonb_build_object(
        'name_ru',s.name_ru,'name_ky',s.name_ky,'name_en',s.name_en,
        'duration_min',bs.duration_min) order by bs.order_index,bs.service_id)
        from public.booking_services bs join public.services s on s.id=bs.service_id
        where bs.booking_id=b.id)
      else jsonb_build_array(jsonb_build_object(
        'name_ru',primary_service.name_ru,'name_ky',primary_service.name_ky,
        'name_en',primary_service.name_en,'duration_min',primary_service.duration_min))
    end
  from public.bookings b
  join public.staff st on st.id=b.staff_id
  join public.services primary_service on primary_service.id=b.service_id
  where b.id=p_id;
$$;


ALTER FUNCTION "public"."booking_receipt_public"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."booking_view_public"("p_id" "uuid") RETURNS TABLE("id" "uuid", "status" "public"."booking_status", "start_at" timestamp with time zone, "end_at" timestamp with time zone, "service_name" "text", "staff_name" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select b.id, b.status, b.start_at, b.end_at, s.name_ru as service_name, st.full_name as staff_name
  from bookings b
  join services s on s.id = b.service_id
  join staff st on st.id = b.staff_id
  where b.id = p_id
$$;


ALTER FUNCTION "public"."booking_view_public"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."branch_admins_effective"("p_branch_id" "uuid") RETURNS TABLE("user_id" "uuid", "source" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_biz_id uuid;
BEGIN
    -- Получаем biz_id филиала
    SELECT biz_id INTO v_biz_id
    FROM branches
    WHERE id = p_branch_id;
    
    IF v_biz_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Возвращаем UNION всех администраторов:
    -- 1. Владелец бизнеса
    RETURN QUERY
    SELECT 
        b.owner_id as user_id,
        'owner'::text as source
    FROM businesses b
    WHERE b.id = v_biz_id
      AND b.owner_id IS NOT NULL;
    
    -- 2. Администраторы бизнеса (через user_roles с ролью 'admin')
    RETURN QUERY
    SELECT DISTINCT
        ur.user_id,
        'biz_admin'::text as source
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.biz_id = v_biz_id
      AND r.key = 'admin';
    
    -- 3. Явные администраторы филиала
    RETURN QUERY
    SELECT 
        ba.user_id,
        'branch_admin'::text as source
    FROM branch_admins ba
    WHERE ba.branch_id = p_branch_id;
    
END;
$$;


ALTER FUNCTION "public"."branch_admins_effective"("p_branch_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."branch_admins_effective"("p_branch_id" "uuid") IS 'Возвращает всех эффективных администраторов филиала: владелец бизнеса, администраторы бизнеса и явные администраторы филиала';



CREATE OR REPLACE FUNCTION "public"."branches_sync_lat_lon_from_coords"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_coords text;
    m text[];
BEGIN
    v_coords := nullif(trim(NEW.coords::text), '');
    IF v_coords IS NULL THEN
        NEW.lat := NULL;
        NEW.lon := NULL;
        RETURN NEW;
    END IF;
    m := regexp_match(v_coords, 'POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)');
    IF m IS NOT NULL AND array_length(m, 1) >= 2 THEN
        NEW.lon := m[1]::numeric;
        NEW.lat := m[2]::numeric;
    ELSE
        NEW.lat := NULL;
        NEW.lon := NULL;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."branches_sync_lat_lon_from_coords"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."branches_sync_lat_lon_from_coords"() IS 'Синхронизирует branches.lat/lon из branches.coords (EWKT) при INSERT/UPDATE (не используется, если lat/lon — generated columns)';



CREATE OR REPLACE FUNCTION "public"."calculate_biz_day_metrics"("p_biz_id" "uuid", "p_metric_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
    v_avg_branch_score numeric;
    v_total_clients integer;
    v_total_revenue numeric;
    v_avg_rating numeric;
    v_total_reviews integer;
    v_day_score numeric;
begin
    -- Агрегируем метрики от филиалов бизнеса за день
    select 
        coalesce(avg(bdm.day_score), 0),
        coalesce(sum(bdm.total_clients_count), 0)::integer,
        coalesce(sum(bdm.total_revenue), 0),
        coalesce(avg(bdm.avg_rating), 0),
        coalesce(sum(bdm.total_reviews_count), 0)::integer
    into v_avg_branch_score, v_total_clients, v_total_revenue, v_avg_rating, v_total_reviews
    from public.branch_day_metrics bdm
    where bdm.biz_id = p_biz_id
      and bdm.metric_date = p_metric_date;
    
    -- Рейтинг бизнеса = средний рейтинг филиалов
    v_day_score := v_avg_branch_score;
    
    -- Сохраняем или обновляем дневные метрики бизнеса
    insert into public.biz_day_metrics (
        biz_id, metric_date,
        avg_branch_score, total_clients_count, total_revenue,
        avg_rating, total_reviews_count,
        day_score
    ) values (
        p_biz_id, p_metric_date,
        v_avg_branch_score, v_total_clients, v_total_revenue,
        v_avg_rating, v_total_reviews,
        v_day_score
    )
    on conflict (biz_id, metric_date) do update set
        avg_branch_score = excluded.avg_branch_score,
        total_clients_count = excluded.total_clients_count,
        total_revenue = excluded.total_revenue,
        avg_rating = excluded.avg_rating,
        total_reviews_count = excluded.total_reviews_count,
        day_score = excluded.day_score,
        updated_at = timezone('utc'::text, now());
end;
$$;


ALTER FUNCTION "public"."calculate_biz_day_metrics"("p_biz_id" "uuid", "p_metric_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_biz_day_metrics"("p_biz_id" "uuid", "p_metric_date" "date") IS 'Рассчитывает дневные метрики и рейтинг для бизнеса за указанную дату';



CREATE OR REPLACE FUNCTION "public"."calculate_biz_rating"("p_biz_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
declare
    v_config record;
    v_avg_day_score numeric;
    v_rating numeric;
    v_last_rating numeric;
    v_metrics_count integer;
    v_default_rating numeric := 50.0;
begin
    -- Получаем активную конфигурацию
    select * into v_config
    from public.rating_global_config
    where is_active = true
    order by valid_from desc
    limit 1;
    
    if v_config is null then
        return null;
    end if;
    
    -- Рассчитываем средний дневной рейтинг за последние N дней
    select 
        avg(day_score),
        count(*)
    into v_avg_day_score, v_metrics_count
    from public.biz_day_metrics
    where biz_id = p_biz_id
      and metric_date >= current_date - (v_config.window_days || ' days')::interval
      and metric_date < current_date;
    
    -- Если есть метрики в окне - используем среднее
    if v_metrics_count > 0 and v_avg_day_score is not null then
        v_rating := round(v_avg_day_score::numeric, 2);
    else
        -- Если нет метрик в окне, используем последний известный рейтинг
        select rating_score into v_last_rating
        from public.businesses
        where id = p_biz_id;
        
        if v_last_rating is not null and v_last_rating > 0 then
            -- Используем последний известный рейтинг
            v_rating := v_last_rating;
        else
            -- Если вообще нет истории, рассчитываем как средний рейтинг филиалов или дефолтный
            select coalesce(avg(br.rating_score), v_default_rating) into v_rating
            from public.branches br
            where br.biz_id = p_biz_id 
              and br.is_active = true 
              and br.rating_score is not null 
              and br.rating_score > 0;
            
            if v_rating is null or v_rating = 0 then
                v_rating := v_default_rating;
            end if;
        end if;
    end if;
    
    -- Обновляем рейтинг в таблице businesses
    update public.businesses
    set 
        rating_score = v_rating,
        rating_updated_at = timezone('utc'::text, now())
    where id = p_biz_id;
    
    return v_rating;
end;
$$;


ALTER FUNCTION "public"."calculate_biz_rating"("p_biz_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_biz_rating"("p_biz_id" "uuid") IS 'Рассчитывает агрегированный рейтинг бизнеса за последние 30 дней. Если нет метрик в окне, использует последний известный рейтинг или средний рейтинг филиалов или дефолтный 50.0.';



CREATE OR REPLACE FUNCTION "public"."calculate_branch_day_metrics"("p_branch_id" "uuid", "p_metric_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
    v_biz_id uuid;
    v_avg_staff_score numeric;
    v_total_clients integer;
    v_total_revenue numeric;
    v_avg_rating numeric;
    v_total_reviews integer;
    v_day_score numeric;
begin
    -- Получаем biz_id
    select biz_id into v_biz_id
    from public.branches
    where id = p_branch_id;
    
    if v_biz_id is null then
        raise exception 'Branch not found';
    end if;
    
    -- Агрегируем метрики от сотрудников филиала за день
    select 
        coalesce(avg(sdm.day_score), 0),
        coalesce(sum(sdm.clients_count), 0)::integer,
        coalesce(sum(sdm.revenue), 0),
        coalesce(avg(sdm.avg_rating), 0),
        coalesce(sum(sdm.reviews_count), 0)::integer
    into v_avg_staff_score, v_total_clients, v_total_revenue, v_avg_rating, v_total_reviews
    from public.staff_day_metrics sdm
    where sdm.branch_id = p_branch_id
      and sdm.metric_date = p_metric_date;
    
    -- Рейтинг филиала = средний рейтинг сотрудников (можно добавить дополнительные факторы)
    v_day_score := v_avg_staff_score;
    
    -- Сохраняем или обновляем дневные метрики филиала
    insert into public.branch_day_metrics (
        branch_id, biz_id, metric_date,
        avg_staff_score, total_clients_count, total_revenue,
        avg_rating, total_reviews_count,
        day_score
    ) values (
        p_branch_id, v_biz_id, p_metric_date,
        v_avg_staff_score, v_total_clients, v_total_revenue,
        v_avg_rating, v_total_reviews,
        v_day_score
    )
    on conflict (branch_id, metric_date) do update set
        avg_staff_score = excluded.avg_staff_score,
        total_clients_count = excluded.total_clients_count,
        total_revenue = excluded.total_revenue,
        avg_rating = excluded.avg_rating,
        total_reviews_count = excluded.total_reviews_count,
        day_score = excluded.day_score,
        updated_at = timezone('utc'::text, now());
end;
$$;


ALTER FUNCTION "public"."calculate_branch_day_metrics"("p_branch_id" "uuid", "p_metric_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_branch_day_metrics"("p_branch_id" "uuid", "p_metric_date" "date") IS 'Рассчитывает дневные метрики и рейтинг для филиала за указанную дату';



CREATE OR REPLACE FUNCTION "public"."calculate_branch_rating"("p_branch_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
declare
    v_config record;
    v_avg_day_score numeric;
    v_rating numeric;
    v_last_rating numeric;
    v_metrics_count integer;
    v_default_rating numeric := 50.0;
begin
    -- Получаем активную конфигурацию
    select * into v_config
    from public.rating_global_config
    where is_active = true
    order by valid_from desc
    limit 1;
    
    if v_config is null then
        return null;
    end if;
    
    -- Рассчитываем средний дневной рейтинг за последние N дней
    select 
        avg(day_score),
        count(*)
    into v_avg_day_score, v_metrics_count
    from public.branch_day_metrics
    where branch_id = p_branch_id
      and metric_date >= current_date - (v_config.window_days || ' days')::interval
      and metric_date < current_date;
    
    -- Если есть метрики в окне - используем среднее
    if v_metrics_count > 0 and v_avg_day_score is not null then
        v_rating := round(v_avg_day_score::numeric, 2);
    else
        -- Если нет метрик в окне, используем последний известный рейтинг
        select rating_score into v_last_rating
        from public.branches
        where id = p_branch_id;
        
        if v_last_rating is not null and v_last_rating > 0 then
            -- Используем последний известный рейтинг
            v_rating := v_last_rating;
        else
            -- Если вообще нет истории, рассчитываем как средний рейтинг сотрудников или дефолтный
            select coalesce(avg(s.rating_score), v_default_rating) into v_rating
            from public.staff s
            where s.branch_id = p_branch_id 
              and s.is_active = true 
              and s.rating_score is not null 
              and s.rating_score > 0;
            
            if v_rating is null or v_rating = 0 then
                v_rating := v_default_rating;
            end if;
        end if;
    end if;
    
    -- Обновляем рейтинг в таблице branches
    update public.branches
    set 
        rating_score = v_rating,
        rating_updated_at = timezone('utc'::text, now())
    where id = p_branch_id;
    
    return v_rating;
end;
$$;


ALTER FUNCTION "public"."calculate_branch_rating"("p_branch_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_branch_rating"("p_branch_id" "uuid") IS 'Рассчитывает агрегированный рейтинг филиала за последние 30 дней. Если нет метрик в окне, использует последний известный рейтинг или средний рейтинг сотрудников или дефолтный 50.0.';



CREATE OR REPLACE FUNCTION "public"."calculate_staff_day_metrics"("p_staff_id" "uuid", "p_metric_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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
    
    -- 1. Метрики отзывов (за день)
    select 
        coalesce(avg(r.rating), 0),
        count(*)::integer
    into v_reviews_avg, v_reviews_count
    from public.reviews r
    join public.bookings b on b.id = r.booking_id
    where b.staff_id = p_staff_id
      and b.status in ('confirmed', 'paid')
      and date(b.start_at at time zone 'Asia/Bishkek') = p_metric_date;
    
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
      and date(b.start_at at time zone 'Asia/Bishkek') = p_metric_date;
    
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
          and date(b.start_at at time zone 'Asia/Bishkek') <= p_metric_date
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
          and date(start_at at time zone 'Asia/Bishkek') = p_metric_date
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
$$;


ALTER FUNCTION "public"."calculate_staff_day_metrics"("p_staff_id" "uuid", "p_metric_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_staff_day_metrics"("p_staff_id" "uuid", "p_metric_date" "date") IS 'Рассчитывает дневные метрики и рейтинг для сотрудника за указанную дату';



CREATE OR REPLACE FUNCTION "public"."calculate_staff_rating"("p_staff_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
declare
    v_config record;
    v_avg_day_score numeric;
    v_rating numeric;
    v_last_rating numeric;
    v_metrics_count integer;
    v_default_rating numeric := 50.0;
begin
    -- Получаем активную конфигурацию
    select * into v_config
    from public.rating_global_config
    where is_active = true
    order by valid_from desc
    limit 1;
    
    if v_config is null then
        return null;
    end if;
    
    -- Рассчитываем средний дневной рейтинг за последние N дней
    -- Считаем только дни с активностью (метрики создаются только при наличии активности)
    select 
        avg(day_score),
        count(*)
    into v_avg_day_score, v_metrics_count
    from public.staff_day_metrics
    where staff_id = p_staff_id
      and metric_date >= current_date - (v_config.window_days || ' days')::interval
      and metric_date < current_date;
    
    -- Если есть метрики в окне - используем среднее
    if v_metrics_count > 0 and v_avg_day_score is not null then
        v_rating := round(v_avg_day_score::numeric, 2);
    else
        -- Если нет метрик в окне, используем последний известный рейтинг
        select rating_score into v_last_rating
        from public.staff
        where id = p_staff_id;
        
        if v_last_rating is not null and v_last_rating > 0 then
            -- Используем последний известный рейтинг (не снижаем его резко)
            v_rating := v_last_rating;
        else
            -- Если вообще нет истории, используем дефолтный рейтинг
            v_rating := v_default_rating;
        end if;
    end if;
    
    -- Обновляем рейтинг в таблице staff
    update public.staff
    set 
        rating_score = v_rating,
        rating_updated_at = timezone('utc'::text, now())
    where id = p_staff_id;
    
    return v_rating;
end;
$$;


ALTER FUNCTION "public"."calculate_staff_rating"("p_staff_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_staff_rating"("p_staff_id" "uuid") IS 'Рассчитывает агрегированный рейтинг сотрудника за последние 30 дней. Если нет метрик в окне, использует последний известный рейтинг или дефолтный 50.0.';



CREATE OR REPLACE FUNCTION "public"."can_edit_review"("p_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.reviews r
    where r.id = p_id
      and r.client_id = auth.uid()
      and r.created_at > now() - interval '24 hours'
  );
$$;


ALTER FUNCTION "public"."can_edit_review"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_review"("p_booking_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.bookings b
    where b.id = p_booking_id
      and b.client_id = auth.uid()
      and b.end_at < now()          -- отзыв только после визита
      and b.status <> 'cancelled'   -- и не по отменённой записи
  );
$$;


ALTER FUNCTION "public"."can_review"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_use_promotion"("p_client_id" "uuid", "p_branch_id" "uuid", "p_promotion_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
            v_visit_count := public.get_client_visit_count(p_client_id, p_branch_id);
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
            v_visit_count := public.get_client_visit_count(p_client_id, p_branch_id);
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
$$;


ALTER FUNCTION "public"."can_use_promotion"("p_client_id" "uuid", "p_branch_id" "uuid", "p_promotion_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_use_promotion"("p_client_id" "uuid", "p_branch_id" "uuid", "p_promotion_id" "uuid") IS 'Проверяет, может ли клиент использовать акцию при бронировании';



CREATE OR REPLACE FUNCTION "public"."cancel_booking"("p_booking_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update bookings
     set status = 'cancelled', expires_at = null
   where id = p_booking_id
     and status in ('hold','confirmed','paid'); -- при необходимости сузить
end $$;


ALTER FUNCTION "public"."cancel_booking"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_business_role_application"("p_application_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
    v_biz_id uuid;
    v_role text;
begin
    update public.business_role_applications
       set status = 'cancelled', updated_at = now()
     where id = p_application_id
       and applicant_user_id = p_user_id
       and status = 'pending'
     returning biz_id, requested_role into v_biz_id, v_role;

    if not found then return false; end if;

    insert into public.application_moderation_actions(
        application_kind, application_id, action, actor_user_id,
        target_user_id, biz_id, reason
    ) values (
        v_role, p_application_id, 'cancelled', p_user_id,
        p_user_id, v_biz_id, 'Отозвано заявителем'
    );
    return true;
end;
$$;


ALTER FUNCTION "public"."cancel_business_role_application"("p_application_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cat_remove_slug"("the_slug" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  update public.businesses
     set categories = array(
       select x
       from unnest(coalesce(categories, '{}'::text[])) as t(x)
       where x <> the_slug
     )
   where categories @> array[the_slug]
  returning 1 into v_count;

  return coalesce(v_count, 0);
end;
$$;


ALTER FUNCTION "public"."cat_remove_slug"("the_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cat_replace_slug"("old_slug" "text", "new_slug" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_count int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  update public.businesses
     set categories = array(
       select case when x = old_slug then new_slug else x end
       from unnest(coalesce(categories, '{}'::text[])) as t(x)
     )
   where categories @> array[old_slug]
  returning 1 into v_count;

  return coalesce(v_count, 0);
end;
$$;


ALTER FUNCTION "public"."cat_replace_slug"("old_slug" "text", "new_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."categories_with_usage_v2"() RETURNS TABLE("id" "uuid", "name_ru" "text", "slug" "text", "is_active" boolean, "usage_count" integer)
    LANGUAGE "sql" STABLE
    AS $$
  select
    c.id,
    c.name_ru,
    c.slug,
    c.is_active,
    coalesce(count(b.id), 0)::int as usage_count
  from public.categories c
  left join public.businesses b
    on c.slug = any (coalesce(b.categories, '{}'::text[]))
  group by c.id, c.name_ru, c.slug, c.is_active
  order by c.name_ru asc
$$;


ALTER FUNCTION "public"."categories_with_usage_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_booking_branch_match"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
    v_date := (NEW.start_at)::date;

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
$$;


ALTER FUNCTION "public"."check_booking_branch_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_explicit_schedule_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."check_explicit_schedule_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_owner_not_suspended"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.owner_id is null then
    return new;
  end if;

  if exists (select 1 from public.user_suspensions s where s.user_id = new.owner_id) then
    raise exception 'USER_SUSPENDED';
  end if;

  return new;
end
$$;


ALTER FUNCTION "public"."check_owner_not_suspended"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_telegram_mobile_auth_attempts"("p_keep_minutes" integer DEFAULT 1440) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_deleted_count integer;
begin
    delete from public.telegram_mobile_auth_attempts
    where expires_at < timezone('utc'::text, now())
        - (greatest(p_keep_minutes, 0) || ' minutes')::interval;

    get diagnostics v_deleted_count = row_count;
    return v_deleted_count;
end;
$$;


ALTER FUNCTION "public"."cleanup_expired_telegram_mobile_auth_attempts"("p_keep_minutes" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_expired_telegram_mobile_auth_attempts"("p_keep_minutes" integer) IS 'Deletes expired telegram_mobile_auth_attempts older than retention window (default 1440 minutes).';



CREATE OR REPLACE FUNCTION "public"."cleanup_expired_whatsapp_otp_codes"("p_keep_minutes" integer DEFAULT 1440) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_deleted_count integer;
begin
    delete from public.whatsapp_otp_codes
    where expires_at < timezone('utc'::text, now())
        - (greatest(p_keep_minutes, 0) || ' minutes')::interval;

    get diagnostics v_deleted_count = row_count;
    return v_deleted_count;
end;
$$;


ALTER FUNCTION "public"."cleanup_expired_whatsapp_otp_codes"("p_keep_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_api_metrics"("p_keep_days" integer DEFAULT 30) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_deleted_count integer;
begin
    -- Удаляем метрики старше указанного количества дней
    -- Оставляем только ошибки (4xx/5xx) навсегда
    delete from public.api_request_metrics
    where created_at < timezone('utc'::text, now()) - (p_keep_days || ' days')::interval
      and status_code < 400;
    
    get diagnostics v_deleted_count = row_count;
    
    return v_deleted_count;
end;
$$;


ALTER FUNCTION "public"."cleanup_old_api_metrics"("p_keep_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_api_metrics"("p_keep_days" integer) IS 'Удаляет старые метрики (кроме ошибок). По умолчанию сохраняет метрики за последние 30 дней.';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_finance_logs"("p_keep_days" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_deleted_count integer;
begin
    -- Удаляем логи старше указанного количества дней
    -- Оставляем только ошибки (error level) навсегда
    delete from public.staff_finance_operation_logs
    where created_at < timezone('utc'::text, now()) - (p_keep_days || ' days')::interval
      and log_level != 'error';
    
    get diagnostics v_deleted_count = row_count;
    
    return v_deleted_count;
end;
$$;


ALTER FUNCTION "public"."cleanup_old_finance_logs"("p_keep_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_finance_logs"("p_keep_days" integer) IS 'Удаляет старые логи операций (кроме ошибок). По умолчанию сохраняет логи за последние 90 дней.';



CREATE OR REPLACE FUNCTION "public"."cleanup_old_funnel_events"("p_keep_days" integer DEFAULT 400) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_deleted_count integer;
begin
    delete from public.funnel_events
    where created_at < timezone('utc'::text, now()) - (p_keep_days || ' days')::interval;
    get diagnostics v_deleted_count = row_count;
    return v_deleted_count;
end;
$$;


ALTER FUNCTION "public"."cleanup_old_funnel_events"("p_keep_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_old_funnel_events"("p_keep_days" integer) IS 'Удаляет события воронки старше указанного количества дней. По умолчанию 400 дней.';



CREATE OR REPLACE FUNCTION "public"."cleanup_telegram_profile_links"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    delete from public.telegram_profile_link_attempts where expires_at < now() - interval '1 day';
$$;


ALTER FUNCTION "public"."cleanup_telegram_profile_links"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."clear_business_owner"("p_biz_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  _prev_owner uuid;
  _owner_role uuid;
begin
  -- узнаём кто был владельцем
  select owner_id into _prev_owner
  from public.businesses
  where id = p_biz_id;

  -- если никого не было — выходим
  if _prev_owner is null then
    return;
  end if;

  -- чистим владельца у бизнеса
  update public.businesses
  set owner_id = null
  where id = p_biz_id;

  -- по желанию: убираем роль owner у этого юзера по этому бизнесу
  select id into _owner_role
  from public.roles
  where key = 'owner' and scope = 'business'
  limit 1;

  if _owner_role is not null then
    delete from public.user_roles
    where user_id = _prev_owner
      and biz_id = p_biz_id
      and role_id = _owner_role;
  end if;
end;
$$;


ALTER FUNCTION "public"."clear_business_owner"("p_biz_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."close_staff_shift_safe"("p_shift_id" "uuid", "p_total_amount" numeric DEFAULT 0, "p_consumables_amount" numeric DEFAULT 0, "p_percent_master" numeric DEFAULT 60, "p_percent_salon" numeric DEFAULT 40, "p_master_share" numeric DEFAULT 0, "p_salon_share" numeric DEFAULT 0, "p_hours_worked" numeric DEFAULT NULL::numeric, "p_hourly_rate" numeric DEFAULT NULL::numeric, "p_guaranteed_amount" numeric DEFAULT 0, "p_topup_amount" numeric DEFAULT 0, "p_closed_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
    v_existing_status text;
    v_result jsonb;
    v_shift_record public.staff_shifts%rowtype;
begin
    -- Lock row and load full shift record
    select *
    into v_shift_record
    from public.staff_shifts
    where id = p_shift_id
    for update;

    v_existing_status := v_shift_record.status;

    -- Shift not found
    if v_existing_status is null then
        return jsonb_build_object(
            'ok', false,
            'error', 'Смена не найдена'
        );
    end if;

    -- Shift already closed or has unexpected status
    if v_existing_status != 'open' then
        if v_existing_status = 'closed' then
            select row_to_json(s)::jsonb
            into v_result
            from public.staff_shifts s
            where s.id = p_shift_id;

            return jsonb_build_object(
                'ok', true,
                'shift', v_result,
                'action', 'already_closed'
            );
        end if;

        return jsonb_build_object(
            'ok', false,
            'error', 'Смена имеет неожиданный статус: ' || v_existing_status
        );
    end if;

    -- Update shift with optimistic check on status
    update public.staff_shifts
    set total_amount       = p_total_amount,
        consumables_amount = p_consumables_amount,
        percent_master     = p_percent_master,
        percent_salon      = p_percent_salon,
        master_share       = p_master_share,
        salon_share        = p_salon_share,
        hours_worked       = p_hours_worked,
        hourly_rate        = p_hourly_rate,
        guaranteed_amount  = p_guaranteed_amount,
        topup_amount       = p_topup_amount,
        status             = 'closed',
        closed_at          = coalesce(p_closed_at, timezone('utc'::text, now()))
    where id = p_shift_id
      and status = 'open';

    if not found then
        return jsonb_build_object(
            'ok', false,
            'error', 'Смена была изменена другим запросом. Попробуйте снова.'
        );
    end if;

    -- Update aggregates using fully initialized v_shift_record
    perform public.update_shift_aggregates(
        v_shift_record.staff_id,
        v_shift_record.biz_id,
        v_shift_record.shift_date,
        p_total_amount,
        p_master_share,
        p_salon_share,
        coalesce(v_shift_record.late_minutes, 0),
        p_guaranteed_amount,
        p_topup_amount
    );

    -- Return updated shift
    select row_to_json(s)::jsonb
    into v_result
    from public.staff_shifts s
    where s.id = p_shift_id;

    return jsonb_build_object(
        'ok', true,
        'shift', v_result,
        'action', 'closed'
    );

exception
    when others then
        return jsonb_build_object(
            'ok', false,
            'error', 'Ошибка при закрытии смены: ' || sqlerrm
        );
end;
$$;


ALTER FUNCTION "public"."close_staff_shift_safe"("p_shift_id" "uuid", "p_total_amount" numeric, "p_consumables_amount" numeric, "p_percent_master" numeric, "p_percent_salon" numeric, "p_master_share" numeric, "p_salon_share" numeric, "p_hours_worked" numeric, "p_hourly_rate" numeric, "p_guaranteed_amount" numeric, "p_topup_amount" numeric, "p_closed_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."close_staff_shift_safe"("p_shift_id" "uuid", "p_total_amount" numeric, "p_consumables_amount" numeric, "p_percent_master" numeric, "p_percent_salon" numeric, "p_master_share" numeric, "p_salon_share" numeric, "p_hours_worked" numeric, "p_hourly_rate" numeric, "p_guaranteed_amount" numeric, "p_topup_amount" numeric, "p_closed_at" timestamp with time zone) IS 'Безопасное закрытие смены с защитой от race conditions и автоматическим обновлением агрегатов статистики.';



CREATE OR REPLACE FUNCTION "public"."confirm_booking"("p_booking_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_current_status booking_status;
begin
    -- Получаем текущий статус бронирования
    select status into v_current_status
    from public.bookings
    where id = p_booking_id;
    
    if not found then
        raise exception 'Booking not found';
    end if;
    
    -- Если статус уже confirmed, просто выходим (идемпотентность)
    if v_current_status = 'confirmed' then
        return;
    end if;
    
    -- Проверяем, что статус можно изменить на 'confirmed'
    if v_current_status not in ('hold') then
        raise exception 'Booking status cannot be changed to confirmed. Current status: %', v_current_status;
    end if;
    
    -- Обновляем статус на 'confirmed' и очищаем expires_at
    update public.bookings
    set status = 'confirmed'::booking_status,
        expires_at = null
    where id = p_booking_id;
    
    if not found then
        raise exception 'Failed to update booking status';
    end if;
end;
$$;


ALTER FUNCTION "public"."confirm_booking"("p_booking_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."confirm_booking"("p_booking_id" "uuid") IS 'Подтверждает бронирование, изменяя статус с hold на confirmed и очищая expires_at. Идемпотентна: если статус уже confirmed, ничего не делает.';



CREATE OR REPLACE FUNCTION "public"."create_internal_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_minutes" integer, "p_client_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_booking_id uuid;
  v_client_role_id uuid;
begin
  -- TODO: твои проверки пересечений/RLS (если были) до вставки

  insert into public.bookings (
    biz_id, branch_id, service_id, staff_id, client_id,
    start_at, end_at, status, time_range, source
  )
  values (
    p_biz_id, p_branch_id, p_service_id, p_staff_id, p_client_id,
    p_start, p_start + make_interval(mins => p_minutes),
    'hold',
    tstzrange(p_start, p_start + make_interval(mins => p_minutes), '[)'),
    'desk'
  )
  returning id into v_booking_id;

  -- назначаем роль 'client' пользователю в этом бизнесе (если ещё нет)
  select id into v_client_role_id
  from public.roles
  where key = 'client'
  limit 1;

  if v_client_role_id is not null and p_client_id is not null then
    insert into public.user_roles(user_id, biz_id, role_id)
    values (p_client_id, p_biz_id, v_client_role_id)
    on conflict (user_id, role_id, biz_id) do nothing;
  end if;

  return v_booking_id;
end;
$$;


ALTER FUNCTION "public"."create_internal_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_minutes" integer, "p_client_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_internal_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_minutes" integer, "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_client_name" "text" DEFAULT NULL::"text", "p_client_phone" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
declare
  v_id uuid;
begin
  -- ВАЖНО: тут остаётся твоя проверка принадлежности сущностей к бизнесу,
  -- проверка пересечений, RLS и т.д. (не меняем)

  insert into bookings (
    biz_id, branch_id, service_id, staff_id,
    start_at, end_at, status,
    client_id, client_name, client_phone
  )
  values (
    p_biz_id, p_branch_id, p_service_id, p_staff_id,
    p_start, p_start + (p_minutes || ' minutes')::interval, 'confirmed',
    p_client_id,
    case when p_client_id is null then nullif(btrim(p_client_name), '') else null end,
    case when p_client_id is null then nullif(btrim(p_client_phone), '') else null end
  )
  returning id into v_id;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."create_internal_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_minutes" integer, "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_internal_complex_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb", "p_client_id" "uuid" DEFAULT NULL::"uuid", "p_client_name" "text" DEFAULT NULL::"text", "p_client_phone" "text" DEFAULT NULL::"text", "p_client_email" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_booking_id uuid;
    v_total_duration_min integer := 0;
    v_item jsonb;
    v_service_id uuid;
    v_duration_min integer;
    v_order_index integer;
    v_index integer := 0;
    v_end timestamptz;
    v_caller_id uuid;
begin
    -- Текущий пользователь (для проверки прав)
    v_caller_id := auth.uid();
    if v_caller_id is null then
        raise exception 'User must be authenticated';
    end if;

    -- Проверка, что пользователь имеет отношение к бизнесу:
    -- либо он сотрудник этого бизнеса, либо имеет роль owner/admin/manager.
    if not exists (
        select 1
        from public.staff s
        where s.user_id = v_caller_id
          and s.biz_id = p_biz_id
          and s.is_active = true
    )
    and not exists (
        select 1
        from public.user_roles ur
        join public.roles r on ur.role_id = r.id
        where ur.user_id = v_caller_id
          and ur.biz_id = p_biz_id
          and r.key in ('owner','admin','manager')
    )
    and not public.is_super_admin()
    then
        raise exception 'no permission to create booking for this business';
    end if;

    -- Проверка филиала
    if not exists (
        select 1
        from public.branches b
        where b.id = p_branch_id
          and b.biz_id = p_biz_id
          and b.is_active = true
    ) then
        raise exception 'branch not found or inactive';
    end if;

    -- Проверка мастера
    if not exists (
        select 1
        from public.staff s
        where s.id = p_staff_id
          and s.biz_id = p_biz_id
          and (s.branch_id = p_branch_id or exists (select 1 from public.staff_schedule_versions v where v.staff_id = p_staff_id))
          and s.is_active = true
    ) then
        raise exception 'staff not found or inactive';
    end if;

    -- Валидация и суммирование услуг
    if p_services is null or jsonb_typeof(p_services) <> 'array' or jsonb_array_length(p_services) = 0 then
        raise exception 'services array must be a non-empty JSON array';
    end if;

    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        if v_service_id is null then
            raise exception 'service_id is required in services[%]', v_index;
        end if;
        if v_duration_min is null or v_duration_min <= 0 then
            raise exception 'duration_min must be positive in services[%]', v_index;
        end if;

        -- Проверяем, что услуга существует и активна в этом бизнесе
        if not exists (
            select 1
            from public.services s
            where s.id = v_service_id
              and s.biz_id = p_biz_id
              and s.active = true
        ) then
            raise exception 'service not found or inactive: %', v_service_id;
        end if;

        v_total_duration_min := v_total_duration_min + v_duration_min;
    end loop;

    if v_total_duration_min <= 0 then
        raise exception 'total duration must be positive';
    end if;

    v_end := p_start + (v_total_duration_min || ' minutes')::interval;

    -- Проверка пересечений с существующими бронированиями мастера
    if exists (
        select 1
        from public.bookings b
        where b.staff_id = p_staff_id
          and (b.status in ('confirmed','paid') or (b.status = 'hold' and b.expires_at > now()))
          and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start, v_end, '[)')
    ) then
        raise exception 'time slot is already booked';
    end if;

    -- Создаём бронирование (service_id = первая услуга комплекса)
    insert into public.bookings (
        biz_id,
        branch_id,
        service_id,
        staff_id,
        client_id,
        client_name,
        client_phone,
        client_email,
        start_at,
        end_at,
        status,
        expires_at
    )
    values (
        p_biz_id,
        p_branch_id,
        (p_services->0->>'service_id')::uuid,
        p_staff_id,
        p_client_id,
        p_client_name,
        p_client_phone,
        p_client_email,
        p_start,
        v_end,
        'confirmed'::booking_status,
        null
    )
    returning id into v_booking_id;

    -- Заполняем booking_services
    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        insert into public.booking_services (
            booking_id,
            service_id,
            duration_min,
            order_index
        )
        values (
            v_booking_id,
            v_service_id,
            v_duration_min,
            v_order_index
        );
    end loop;

    return v_booking_id;
end;
$$;


ALTER FUNCTION "public"."create_internal_complex_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_internal_complex_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") IS 'Создаёт внутреннее бронирование с комплексом услуг (несколько услуг за один визит) сразу в статусе confirmed и заполняет booking_services.';



CREATE OR REPLACE FUNCTION "public"."delete_business_cascade"("p_biz_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  delete from public.bookings       where biz_id = p_biz_id;
  delete from public.working_hours  where biz_id = p_biz_id;
  delete from public.services       where biz_id = p_biz_id;
  delete from public.staff          where biz_id = p_biz_id;
  delete from public.branches       where biz_id = p_biz_id;
  delete from public.user_roles     where biz_id = p_biz_id;

  delete from public.businesses where id = p_biz_id;
end;
$$;


ALTER FUNCTION "public"."delete_business_cascade"("p_biz_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dev_become_superadmin"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.grant_role(auth.uid(), null::uuid, 'super_admin');
  return;
end;
$$;


ALTER FUNCTION "public"."dev_become_superadmin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_business_branch_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    allowed_count integer;
    current_count integer;
begin
    select branch_limit
    into allowed_count
    from public.businesses
    where id = new.biz_id
    for update;

    if allowed_count is null then
        raise exception using errcode = '23503', message = 'BUSINESS_NOT_FOUND';
    end if;

    select count(*)::integer
    into current_count
    from public.branches
    where biz_id = new.biz_id;

    if current_count >= allowed_count then
        raise exception using
            errcode = 'P0001',
            message = format('BRANCH_LIMIT_REACHED:%s:%s', current_count, allowed_count);
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."enforce_business_branch_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_business_registration_application_policy"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
    v_identity text;
    v_active_count integer;
    v_month_count integer;
    v_prior_count integer;
    v_rejected_count integer;
begin
    v_identity := coalesce(new.applicant_user_id::text, new.phone);
    perform pg_advisory_xact_lock(hashtextextended('business-registration:' || v_identity, 0));

    if exists (
        select 1
        from public.application_submission_blocks b
        where b.application_kind = 'business_registration'
          and b.blocked_until > now()
          and (
              (new.applicant_user_id is not null and b.subject_user_id = new.applicant_user_id)
              or (b.subject_phone is not null and b.subject_phone = new.phone)
          )
    ) then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:blocked';
    end if;

    if exists (
        select 1
        from public.business_registration_applications a
        where a.status in ('new', 'contacted')
          and lower(btrim(a.business_name)) = lower(btrim(new.business_name))
          and (
              (new.applicant_user_id is not null and a.applicant_user_id = new.applicant_user_id)
              or a.phone = new.phone
          )
    ) then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:pending_duplicate';
    end if;

    select count(*) into v_active_count
    from public.business_registration_applications a
    where a.status in ('new', 'contacted')
      and (
          (new.applicant_user_id is not null and a.applicant_user_id = new.applicant_user_id)
          or a.phone = new.phone
      );
    if v_active_count >= 2 then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:active_limit';
    end if;

    select count(*) into v_month_count
    from public.business_registration_applications a
    where a.created_at >= now() - interval '30 days'
      and (
          (new.applicant_user_id is not null and a.applicant_user_id = new.applicant_user_id)
          or a.phone = new.phone
      );
    if v_month_count >= 3 then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:monthly_limit';
    end if;

    if exists (
        select 1
        from public.business_registration_applications a
        where a.status = 'rejected'
          and coalesce(a.reviewed_at, a.updated_at) > now() - interval '24 hours'
          and (
              (new.applicant_user_id is not null and a.applicant_user_id = new.applicant_user_id)
              or a.phone = new.phone
          )
    ) then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:cooldown_24h';
    end if;

    select count(*), count(*) filter (where a.status = 'rejected')
      into v_prior_count, v_rejected_count
    from public.business_registration_applications a
    where (new.applicant_user_id is not null and a.applicant_user_id = new.applicant_user_id)
       or a.phone = new.phone;

    new.prior_submission_count := v_prior_count;
    new.risk_flags := array_remove(array[
        case when new.applicant_user_id is null then 'guest_submission' end,
        case when v_prior_count > 0 then 'repeat_applicant' end,
        case when v_rejected_count >= 2 then 'multiple_rejections' end
    ], null);
    return new;
end;
$$;


ALTER FUNCTION "public"."enforce_business_registration_application_policy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_business_role_application_policy"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
    v_pending_limit integer;
    v_cooldown interval;
    v_prior_count integer;
    v_rejected_count integer;
begin
    perform pg_advisory_xact_lock(hashtextextended('business-role:' || new.applicant_user_id::text || ':' || new.requested_role, 0));

    if new.requested_role not in ('owner', 'staff') then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:unsupported_role';
    end if;

    if new.policy_version >= 1
       and new.requested_role = 'owner'
       and coalesce(length(btrim(new.message)), 0) < 20
       and new.evidence_links = '{}'::jsonb then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:owner_evidence_required';
    end if;

    if exists (
        select 1
        from public.application_submission_blocks b
        where b.application_kind = new.requested_role
          and b.subject_user_id = new.applicant_user_id
          and b.blocked_until > now()
          and (b.biz_id is null or b.biz_id = new.biz_id)
    ) then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:blocked';
    end if;

    if new.requested_role = 'staff' and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = new.applicant_user_id
          and ur.biz_id = new.biz_id
          and r.key = 'owner'
    ) then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:owner_cannot_be_staff';
    end if;

    v_pending_limit := case when new.requested_role = 'owner' then 3 else 5 end;
    if (select count(*) from public.business_role_applications a
        where a.applicant_user_id = new.applicant_user_id
          and a.requested_role = new.requested_role
          and a.status = 'pending') >= v_pending_limit then
        raise exception using errcode = 'P0001', message = 'APPLICATION_POLICY:active_limit';
    end if;

    v_cooldown := case when new.requested_role = 'owner' then interval '7 days' else interval '3 days' end;
    if exists (
        select 1
        from public.business_role_applications a
        where a.applicant_user_id = new.applicant_user_id
          and a.biz_id = new.biz_id
          and a.requested_role = new.requested_role
          and a.status = 'rejected'
          and coalesce(a.reviewed_at, a.updated_at) > now() - v_cooldown
    ) then
        raise exception using errcode = 'P0001', message = case
            when new.requested_role = 'owner' then 'APPLICATION_POLICY:cooldown_7d'
            else 'APPLICATION_POLICY:cooldown_3d'
        end;
    end if;

    select count(*), count(*) filter (where a.status = 'rejected')
      into v_prior_count, v_rejected_count
    from public.business_role_applications a
    where a.applicant_user_id = new.applicant_user_id
      and a.requested_role = new.requested_role;

    new.prior_submission_count := v_prior_count;
    new.risk_flags := array_remove(array[
        case when v_prior_count > 0 then 'repeat_applicant' end,
        case when v_rejected_count > 0 then 'prior_rejection' end,
        case when v_prior_count >= 3 then 'high_submission_volume' end
    ], null);
    return new;
end;
$$;


ALTER FUNCTION "public"."enforce_business_role_application_policy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."exec_grant_owner"("p_biz_id" "uuid", "p_user_id" "uuid", "p_role_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- удалить прошлые owner для этого бизнеса
  delete from public.user_roles
   where biz_id = p_biz_id
     and role_id = p_role_id;

  -- вставить (или оставить) новую запись
  insert into public.user_roles(user_id, biz_id, role_id)
  values (p_user_id, p_biz_id, p_role_id)
  on conflict (user_id, role_id, biz_id) do nothing;

  -- проставить owner_id у бизнеса
  update public.businesses
     set owner_id = p_user_id
   where id = p_biz_id;
end;
$$;


ALTER FUNCTION "public"."exec_grant_owner"("p_biz_id" "uuid", "p_user_id" "uuid", "p_role_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_due_account_deletions"("batch_limit" integer DEFAULT 50) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
    request_row record;
    completed_count integer := 0;
    has_blocker boolean;
begin
    for request_row in
        select user_id
        from public.account_deletion_requests
        where status = 'pending' and scheduled_for <= now()
        order by scheduled_for
        limit greatest(1, least(batch_limit, 200))
        for update skip locked
    loop
        select
            exists(select 1 from public.businesses where owner_id = request_row.user_id)
            or exists(select 1 from public.staff where user_id = request_row.user_id)
            or exists(select 1 from public.user_roles where user_id = request_row.user_id)
            or exists(select 1 from public.user_global_roles where user_id = request_row.user_id)
            or exists(select 1 from public.super_admins_legacy where user_id = request_row.user_id)
            or exists(
                select 1 from public.bookings
                where client_id = request_row.user_id
                  and status in ('hold', 'confirmed', 'paid')
                  and start_at >= now()
            )
        into has_blocker;

        if has_blocker then
            update public.account_deletion_requests
            set status = 'blocked', updated_at = now()
            where user_id = request_row.user_id;
            continue;
        end if;

        delete from public.reviews where client_id = request_row.user_id;
        update public.bookings
        set client_id = null,
            client_name = 'Удалённый пользователь',
            client_email = null,
            client_phone = null
        where client_id = request_row.user_id;

        delete from public.user_current_business where user_id = request_row.user_id;
        delete from public.profiles where id = request_row.user_id;
        delete from auth.users where id = request_row.user_id;

        update public.account_deletion_requests
        set status = 'completed', completed_at = now(), updated_at = now()
        where user_id = request_row.user_id;
        completed_count := completed_count + 1;
    end loop;

    return completed_count;
end;
$$;


ALTER FUNCTION "public"."finalize_due_account_deletions"("batch_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."force_delete_business_and_downgrade_owner"("p_biz_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_owner_id uuid;
begin
  -- 0) прочитать текущего владельца на всякий случай
  select owner_id into v_owner_id
  from public.businesses
  where id = p_biz_id
  for update; -- чтобы избежать гонок

  -- 1) убрать привязку владельца
  update public.businesses
  set owner_id = null
  where id = p_biz_id;

  -- 2) убрать все роли по этому бизнесу
  delete from public.user_roles
  where biz_id = p_biz_id;

  -- 3) подчистить зависимые сущности, если нет ON DELETE CASCADE
  -- (раскомментируйте нужные строки, если у вас не каскад)
  -- delete from public.bookings       where biz_id = p_biz_id;
  -- delete from public.working_hours  where biz_id = p_biz_id;
  -- delete from public.service_staff  where biz_id = p_biz_id;
  -- delete from public.services       where biz_id = p_biz_id;
  -- delete from public.branches       where biz_id = p_biz_id;

  -- 4) удалить сам бизнес
  delete from public.businesses
  where id = p_biz_id;

  -- На выходе: бывший владелец остаётся обычным пользователем системы
  -- (без ролей по удалённому бизнесу). Если у него были роли в других бизнесах — они сохранены.
end;
$$;


ALTER FUNCTION "public"."force_delete_business_and_downgrade_owner"("p_biz_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_api_metrics_stats"("p_endpoint" "text", "p_window_minutes" integer DEFAULT 60, "p_method" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_result jsonb;
    v_window_start timestamptz;
begin
    v_window_start := timezone('utc'::text, now()) - (p_window_minutes || ' minutes')::interval;
    
    select jsonb_build_object(
        'endpoint', p_endpoint,
        'method', coalesce(p_method, 'all'),
        'window_minutes', p_window_minutes,
        'total_requests', count(*),
        'success_count', count(*) filter (where status_code < 400),
        'client_error_count', count(*) filter (where status_code >= 400 and status_code < 500),
        'server_error_count', count(*) filter (where status_code >= 500),
        'avg_duration_ms', coalesce(avg(duration_ms), 0),
        'min_duration_ms', coalesce(min(duration_ms), 0),
        'max_duration_ms', coalesce(max(duration_ms), 0),
        'p95_duration_ms', coalesce(
            percentile_cont(0.95) within group (order by duration_ms),
            0
        ),
        'p99_duration_ms', coalesce(
            percentile_cont(0.99) within group (order by duration_ms),
            0
        ),
        'error_rate', case 
            when count(*) > 0 then 
                round((count(*) filter (where status_code >= 400)::numeric / count(*)::numeric) * 100, 2)
            else 0
        end,
        'error_types', jsonb_agg(distinct error_type) filter (where error_type is not null),
        'status_codes', jsonb_object_agg(
            status_code::text,
            count(*)
        ) filter (where status_code is not null)
    )
    into v_result
    from public.api_request_metrics
    where endpoint = p_endpoint
      and created_at >= v_window_start
      and (p_method is null or method = p_method);
    
    return coalesce(v_result, jsonb_build_object('error', 'No data'));
end;
$$;


ALTER FUNCTION "public"."get_api_metrics_stats"("p_endpoint" "text", "p_window_minutes" integer, "p_method" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_api_metrics_stats"("p_endpoint" "text", "p_window_minutes" integer, "p_method" "text") IS 'Возвращает статистику по эндпоинту за указанный период времени.';



CREATE OR REPLACE FUNCTION "public"."get_applicable_visit_package_for_booking"("p_booking_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."get_applicable_visit_package_for_booking"("p_booking_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_applicable_visit_package_for_booking"("p_booking_id" "uuid") IS 'Возвращает id подходящего пакета визитов для бронирования (приоритет: с истекающим сроком).';



CREATE OR REPLACE FUNCTION "public"."get_business_finance_stats"("p_biz_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_branch_id" "uuid" DEFAULT NULL::"uuid", "p_include_open" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result jsonb;
    v_today date;
BEGIN
    v_today := current_date;
    
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
$$;


ALTER FUNCTION "public"."get_business_finance_stats"("p_biz_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_branch_id" "uuid", "p_include_open" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_business_finance_stats"("p_biz_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_branch_id" "uuid", "p_include_open" boolean) IS 'Получает финансовую статистику по всем сотрудникам бизнеса за период. Исправлена версия без вложенных агрегатных функций.';



CREATE OR REPLACE FUNCTION "public"."get_client_visit_count"("p_client_id" "uuid", "p_branch_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    v_count integer;
begin
    -- Считаем только завершенные (paid) бронирования в этом филиале
    select count(*)::integer
    into v_count
    from public.bookings
    where client_id = p_client_id
      and branch_id = p_branch_id
      and status = 'paid'
      and end_at < now();
    
    return coalesce(v_count, 0);
end;
$$;


ALTER FUNCTION "public"."get_client_visit_count"("p_client_id" "uuid", "p_branch_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_client_visit_count"("p_client_id" "uuid", "p_branch_id" "uuid") IS 'Возвращает количество посещений клиента в филиале';



CREATE OR REPLACE FUNCTION "public"."get_failed_api_requests"("p_endpoint" "text" DEFAULT NULL::"text", "p_window_minutes" integer DEFAULT 60, "p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "endpoint" "text", "method" "text", "status_code" integer, "duration_ms" integer, "error_type" "text", "error_message" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_window_start timestamptz;
begin
    v_window_start := timezone('utc'::text, now()) - (p_window_minutes || ' minutes')::interval;
    
    return query
    select 
        m.id,
        m.endpoint,
        m.method,
        m.status_code,
        m.duration_ms,
        m.error_type,
        m.error_message,
        m.created_at
    from public.api_request_metrics m
    where m.status_code >= 400
      and m.created_at >= v_window_start
      and (p_endpoint is null or m.endpoint = p_endpoint)
    order by m.created_at desc
    limit p_limit;
end;
$$;


ALTER FUNCTION "public"."get_failed_api_requests"("p_endpoint" "text", "p_window_minutes" integer, "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_failed_api_requests"("p_endpoint" "text", "p_window_minutes" integer, "p_limit" integer) IS 'Возвращает список запросов с ошибками за указанный период.';



CREATE OR REPLACE FUNCTION "public"."get_free_slots_complex_day_v1"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_day" "date", "p_duration_min" integer, "p_step_min" integer DEFAULT 15, "p_per_staff" integer DEFAULT 200) RETURNS TABLE("staff_id" "uuid", "branch_id" "uuid", "start_at" timestamp with time zone, "end_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_staff record;
    v_sched record;
    v_biz_tz text;
    v_effective_branch_id uuid;
begin
    if p_duration_min is null or p_duration_min <= 0 then
        raise exception 'INVALID_DURATION_MIN';
    end if;

    select b.tz into v_biz_tz from public.businesses b where b.id = p_biz_id;
    if v_biz_tz is null then
        v_biz_tz := 'Asia/Bishkek';
    end if;

    for v_staff in
        select st.id as staff_id, st.branch_id as home_branch_id
        from public.staff st
        where st.biz_id = p_biz_id
          and st.is_active
          and (p_staff_id is null or st.id = p_staff_id)
    loop
        select * into v_sched from public.resolve_staff_day(v_staff.staff_id, p_day);
        if not found then continue; end if;
        if v_sched.intervals is null or jsonb_array_length(v_sched.intervals) = 0 then
            continue;
        end if;

        v_effective_branch_id := v_sched.branch_id;
        if p_branch_id is not null and v_effective_branch_id is distinct from p_branch_id then
            continue;
        end if;

        return query
        with
            raw_intervals as (
                select jsonb_array_elements(v_sched.intervals) as j
            ),
            work as (
                select
                    ((p_day::text || ' ' || (j->>'start'))::timestamp) as begin_local,
                    ((p_day::text || ' ' || (j->>'end'))::timestamp)   as end_local
                from raw_intervals
            ),
            timeline as (
                select
                    generate_series(
                        w.begin_local,
                        w.end_local - make_interval(mins => p_duration_min),
                        make_interval(mins => p_step_min)
                    ) as slot_local_start
                from work w
                where w.end_local > w.begin_local
            ),
            slots_local as (
                select
                    t.slot_local_start,
                    t.slot_local_start + make_interval(mins => p_duration_min) as slot_local_end
                from timeline t
            ),
            breaks_local as (
                select
                    ((p_day::text || ' ' || (j->>'start'))::timestamp) as b_start_local,
                    ((p_day::text || ' ' || (j->>'end'))::timestamp)   as b_end_local
                from jsonb_array_elements(coalesce(v_sched.breaks, '[]'::jsonb)) as j
            ),
            slots_no_breaks as (
                select s.*
                from slots_local s
                where not exists (
                    select 1
                    from breaks_local b
                    where tstzrange((s.slot_local_start at time zone v_biz_tz), (s.slot_local_end at time zone v_biz_tz), '[)')
                          && tstzrange((b.b_start_local at time zone v_biz_tz), (b.b_end_local at time zone v_biz_tz), '[)')
                )
            ),
            slots_tz as (
                select
                    (s.slot_local_start at time zone v_biz_tz) as slot_start,
                    (s.slot_local_end   at time zone v_biz_tz) as slot_end
                from slots_no_breaks s
            ),
            free as (
                select stz.slot_start, stz.slot_end
                from slots_tz stz
                where not exists (
                    select 1
                    from public.bookings bk
                    where bk.biz_id = p_biz_id
                      and bk.staff_id = v_staff.staff_id
                      and (bk.status in ('confirmed', 'paid') or (bk.status='hold' and bk.expires_at>now()))
                      and tstzrange(bk.start_at, bk.end_at, '[)') && tstzrange(stz.slot_start, stz.slot_end, '[)')
                )
                order by stz.slot_start
                limit p_per_staff
            )
        select v_staff.staff_id, coalesce(p_branch_id, v_effective_branch_id), f.slot_start, f.slot_end
        from free f;
    end loop;

    return;
end;
$$;


ALTER FUNCTION "public"."get_free_slots_complex_day_v1"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_day" "date", "p_duration_min" integer, "p_step_min" integer, "p_per_staff" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_free_slots_complex_day_v1"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_day" "date", "p_duration_min" integer, "p_step_min" integer, "p_per_staff" integer) IS 'Свободные слоты для комплекса услуг (суммарная длительность). Блокируют только confirmed/paid бронирования, как get_free_slots_service_day_v2. SECURITY DEFINER для обхода RLS при вызове от anon.';



CREATE OR REPLACE FUNCTION "public"."get_free_slots_service_day"("p_biz_id" "uuid", "p_service_id" "uuid", "p_day" "date", "p_per_staff" integer DEFAULT 3, "p_step_min" integer DEFAULT 15, "p_tz" "text" DEFAULT 'Asia/Bishkek'::"text") RETURNS TABLE("staff_id" "uuid", "start_at" timestamp with time zone, "end_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
with svc as (
  select duration_min from services
  where id = p_service_id and biz_id = p_biz_id and active = true
),
masters as (
  select st.id as staff_id
  from service_staff ss
  join staff st on st.id = ss.staff_id and st.biz_id = p_biz_id and st.is_active = true
  where ss.service_id = p_service_id
),
hours as (
  select
    wh.staff_id,
    -- границы окна локально
    make_timestamptz(extract(year from p_day)::int,
                     extract(month from p_day)::int,
                     extract(day from p_day)::int,
                     split_part(i->>'start',':',1)::int,
                     split_part(i->>'start',':',2)::int,
                     0, p_tz) at time zone p_tz as start_local,
    make_timestamptz(extract(year from p_day)::int,
                     extract(month from p_day)::int,
                     extract(day from p_day)::int,
                     split_part(i->>'end',':',1)::int,
                     split_part(i->>'end',':',2)::int,
                     0, p_tz) at time zone p_tz as end_local
  from working_hours wh
  join masters m on m.staff_id = wh.staff_id
  cross join lateral jsonb_array_elements(wh.intervals) as i
  where wh.biz_id = p_biz_id
    and wh.day_of_week = extract(isodow from p_day)::int % 7
),
grid as (
  select
    h.staff_id,
    (gs.slot at time zone p_tz) at time zone 'UTC' as start_at, -- делаем timestamptz корректно
    (gs.slot + (svc.duration_min || ' minutes')::interval) at time zone 'UTC' as end_at
  from hours h
  cross join svc
  cross join lateral generate_series(
    h.start_local,
    h.end_local - (svc.duration_min || ' minutes')::interval,
    (p_step_min || ' minutes')::interval
  ) as gs(slot)
),
free as (
  select g.*
  from grid g
  where not exists (
    select 1 from bookings b
    where b.biz_id = p_biz_id
      and b.staff_id = g.staff_id
      and b.status in ('hold','confirmed','paid')
      and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(g.start_at, g.end_at, '[)')
  )
)
select staff_id, start_at, end_at
from (
  select f.*,
         row_number() over (partition by staff_id order by start_at asc) as rn
  from free f
) t
where rn <= p_per_staff
order by staff_id, start_at;
$$;


ALTER FUNCTION "public"."get_free_slots_service_day"("p_biz_id" "uuid", "p_service_id" "uuid", "p_day" "date", "p_per_staff" integer, "p_step_min" integer, "p_tz" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_free_slots_service_day_v2"("p_biz_id" "uuid", "p_service_id" "uuid", "p_day" "date", "p_per_staff" integer DEFAULT 200, "p_step_min" integer DEFAULT 15) RETURNS TABLE("staff_id" "uuid", "branch_id" "uuid", "start_at" timestamp with time zone, "end_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_service record;
  v_staff record;
  v_sched record;
  v_dur_min int;
  v_biz_tz text;
  v_effective_branch_id uuid;
BEGIN
  -- 1) сервис и его филиал
  SELECT s.id, s.biz_id, s.branch_id, s.duration_min
  INTO v_service
  FROM public.services s
  WHERE s.id = p_service_id AND s.biz_id = p_biz_id AND s.active;

  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND_OR_INACTIVE';
  END IF;

  v_dur_min := v_service.duration_min;

  -- tz бизнеса
  SELECT b.tz INTO v_biz_tz FROM public.businesses b WHERE b.id = p_biz_id;
  IF v_biz_tz IS NULL THEN v_biz_tz := 'Asia/Bishkek'; END IF;

  -- 2) перебираем активных сотрудников бизнеса
  FOR v_staff IN
    SELECT st.id AS staff_id, st.branch_id AS home_branch_id
    FROM public.staff st
    WHERE st.biz_id = p_biz_id
      AND st.is_active
  LOOP
    -- Получаем расписание на дату (resolve_staff_day уже учитывает временные переводы)
    SELECT * INTO v_sched FROM public.resolve_staff_day(v_staff.staff_id, p_day);
    IF NOT FOUND THEN CONTINUE; END IF;

    -- Проверяем, что в расписании есть интервалы работы
    IF v_sched.intervals IS NULL OR jsonb_array_length(v_sched.intervals) = 0 THEN
      CONTINUE;
    END IF;

    -- Определяем эффективный филиал мастера на эту дату из расписания
    v_effective_branch_id := v_sched.branch_id;

    -- The canonical resolver already decided the branch. A second lookup must
    -- never resurrect a superseded transfer in a different branch.
    IF v_effective_branch_id IS DISTINCT FROM v_service.branch_id THEN CONTINUE; END IF;

    -- генерим сетку слотов в локальном времени бизнеса → переводим в timestamptz
    RETURN QUERY
      WITH
        raw_intervals AS (
          SELECT jsonb_array_elements(v_sched.intervals) AS j
        ),
        work AS (
          SELECT
            -- локальный старт/финиш (ts without tz), собранные из p_day + 'HH:MM'
            ( (p_day::text || ' ' || (j->>'start'))::timestamp ) AS begin_local,
            ( (p_day::text || ' ' || (j->>'end'))::timestamp )   AS end_local
          FROM raw_intervals
        ),
        timeline AS (
          SELECT
            generate_series(
              w.begin_local,
              w.end_local - make_interval(mins => v_dur_min),
              make_interval(mins => p_step_min)
            ) AS slot_local_start
          FROM work w
          WHERE w.end_local > w.begin_local
        ),
        slots_local AS (
          SELECT
            t.slot_local_start,
            t.slot_local_start + make_interval(mins => v_dur_min) AS slot_local_end
          FROM timeline t
        ),
        -- убираем перерывы
        breaks_local AS (
          SELECT
            ( (p_day::text || ' ' || (j->>'start'))::timestamp ) AS b_start_local,
            ( (p_day::text || ' ' || (j->>'end'))::timestamp )   AS b_end_local
          FROM jsonb_array_elements(v_sched.breaks) AS j
        ),
        slots_no_breaks AS (
          SELECT s.*
          FROM slots_local s
          WHERE NOT EXISTS (
            SELECT 1
            FROM breaks_local b
            WHERE tstzrange((s.slot_local_start AT TIME ZONE v_biz_tz), (s.slot_local_end AT TIME ZONE v_biz_tz), '[)')
                  && tstzrange((b.b_start_local AT TIME ZONE v_biz_tz), (b.b_end_local AT TIME ZONE v_biz_tz), '[)')
          )
        ),
        slots_tz AS (
          SELECT
            -- приводим «локальное» время бизнеса к timestamptz (UTC)
            (s.slot_local_start AT TIME ZONE v_biz_tz) AS slot_start,
            (s.slot_local_end   AT TIME ZONE v_biz_tz) AS slot_end
          FROM slots_no_breaks s
        ),
        free AS (
          SELECT stz.slot_start, stz.slot_end
          FROM slots_tz stz
          WHERE NOT EXISTS (
            SELECT 1
            FROM public.bookings bk
            WHERE bk.biz_id = p_biz_id
              AND bk.staff_id = v_staff.staff_id
              AND (bk.status IN ('confirmed', 'paid') OR (bk.status='hold' AND bk.expires_at>now()))
              AND tstzrange(bk.start_at, bk.end_at, '[)') && tstzrange(stz.slot_start, stz.slot_end, '[)')
          )
          ORDER BY stz.slot_start
          LIMIT p_per_staff
        )
    SELECT v_staff.staff_id, v_effective_branch_id, f.slot_start, f.slot_end
    FROM free f;
  END LOOP;

  RETURN;
END$$;


ALTER FUNCTION "public"."get_free_slots_service_day_v2"("p_biz_id" "uuid", "p_service_id" "uuid", "p_day" "date", "p_per_staff" integer, "p_step_min" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_free_slots_service_day_v2"("p_biz_id" "uuid", "p_service_id" "uuid", "p_day" "date", "p_per_staff" integer, "p_step_min" integer) IS 'Возвращает свободные слоты для услуги на указанный день. Учитывает только подтвержденные (confirmed) и оплаченные (paid) бронирования. Использует SECURITY DEFINER для обхода RLS и видит все бронирования независимо от пользователя.';



CREATE OR REPLACE FUNCTION "public"."get_my_notification_emails"() RETURNS TABLE("email" "text", "verified" boolean, "enabled" boolean, "sources" "text"[])
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select
        email.email,
        email.verified,
        email.enabled,
        coalesce(array_agg(source.source order by source.source), array[]::text[]) as sources
    from public.user_notification_emails email
    left join public.user_notification_email_sources source
        on source.email_id = email.id
    where email.user_id = auth.uid()
    group by email.id
    order by email.created_at, email.email;
$$;


ALTER FUNCTION "public"."get_my_notification_emails"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_slow_api_requests"("p_endpoint" "text" DEFAULT NULL::"text", "p_threshold_ms" integer DEFAULT 1000, "p_limit" integer DEFAULT 100) RETURNS TABLE("id" "uuid", "endpoint" "text", "method" "text", "status_code" integer, "duration_ms" integer, "created_at" timestamp with time zone, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    return query
    select 
        m.id,
        m.endpoint,
        m.method,
        m.status_code,
        m.duration_ms,
        m.created_at,
        m.error_message
    from public.api_request_metrics m
    where m.duration_ms >= p_threshold_ms
      and (p_endpoint is null or m.endpoint = p_endpoint)
    order by m.duration_ms desc, m.created_at desc
    limit p_limit;
end;
$$;


ALTER FUNCTION "public"."get_slow_api_requests"("p_endpoint" "text", "p_threshold_ms" integer, "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_slow_api_requests"("p_endpoint" "text", "p_threshold_ms" integer, "p_limit" integer) IS 'Возвращает список медленных запросов (выше порога).';



CREATE OR REPLACE FUNCTION "public"."get_staff_finance_stats"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_include_open" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
    v_result jsonb;
    v_today date;
    v_open_shift_id uuid;
    v_open_shift_data jsonb;
begin
    v_today := current_date;
    
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
$$;


ALTER FUNCTION "public"."get_staff_finance_stats"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_include_open" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_staff_finance_stats"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_include_open" boolean) IS 'Получает финансовую статистику по сотруднику за период. Оптимизированная версия с агрегацией на стороне БД.';



CREATE OR REPLACE FUNCTION "public"."grant_branch_admin"("p_branch_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into public.branch_admins(branch_id, user_id)
  values (p_branch_id, p_user_id)
  on conflict (branch_id, user_id) do nothing;
$$;


ALTER FUNCTION "public"."grant_branch_admin"("p_branch_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_role"("p_user_id" "uuid", "p_role_key" "text", "p_biz_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_is_super boolean;
  v_role_id uuid;
begin
  -- только супер-админ
  select public.has_role('super_admin', null) into v_is_super;
  if not v_is_super then
    raise exception 'forbidden';
  end if;

  select id into v_role_id from public.roles where key = p_role_key;
  if v_role_id is null then
    raise exception 'invalid role key %', p_role_key;
  end if;

  insert into public.user_roles(user_id, role_id, biz_id)
  values (p_user_id, v_role_id, p_biz_id)
  on conflict do nothing;
end;
$$;


ALTER FUNCTION "public"."grant_role"("p_user_id" "uuid", "p_role_key" "text", "p_biz_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_role"("p_user" "uuid", "p_biz" "uuid", "p_role_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  rid uuid;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  rid := public.role_id(p_role_key);
  if rid is null then
    raise exception 'invalid role';
  end if;

  insert into public.user_roles(user_id, biz_id, role_id)
  values(p_user, p_biz, rid)
  on conflict (user_id, biz_id, role_id) do nothing;
end;
$$;


ALTER FUNCTION "public"."grant_role"("p_user" "uuid", "p_biz" "uuid", "p_role_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_role_rpc"("p_user" "uuid", "p_biz" "uuid", "p_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_role_id uuid;
  v_allowed boolean;
begin
  -- роль существует?
  select id into v_role_id from public.roles where key = p_role;
  if v_role_id is null then
    raise exception 'invalid role %', p_role using errcode = 'P0001';
  end if;

  -- право вызывать
  if p_biz is null then
    -- глобальные роли может назначать только super_admin
    v_allowed := public.has_role('super_admin'::text, null::uuid);
  else
    v_allowed :=
      public.has_role('super_admin'::text, null::uuid) or
      public.has_role('owner'::text,   p_biz) or
      public.has_role('admin'::text,   p_biz) or
      public.has_role('manager'::text, p_biz);
  end if;

  if not v_allowed then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  -- вставка, без дублей
  insert into public.user_roles(user_id, biz_id, role_id)
  values (p_user, p_biz, v_role_id)
  on conflict do nothing;
end;
$$;


ALTER FUNCTION "public"."grant_role_rpc"("p_user" "uuid", "p_biz" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_user_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  insert into public.user_roles(user_id, role_id, biz_id)
  select p_user_id, r.id, p_biz_id            -- <= БЫЛО r.role_id
  from public.roles r
  where r.key = p_role_key
  on conflict do nothing;
$$;


ALTER FUNCTION "public"."grant_user_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_last_super_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_sa uuid;
begin
  select id into v_sa from public.roles where key='super_admin';
  if OLD.role_id = v_sa and OLD.biz_id is null then
    perform 1
      from public.user_roles
      where biz_id is null and role_id = v_sa and user_id <> OLD.user_id
      limit 1;
    if not found then
      raise exception 'Нельзя удалить последнего super_admin' using errcode='P0001';
    end if;
  end if;
  return OLD;
end $$;


ALTER FUNCTION "public"."guard_last_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_legacy_staff_schedule_write"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."guard_legacy_staff_schedule_write"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_staff_absence_booking"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
                                                                    declare business_tz text;
                                                                    begin
                                                                     if tg_op='UPDATE' then
                                                                        if old.cancelled_at is not null or new.cancelled_at is null or new.cancelled_by is null or (to_jsonb(new)-'cancelled_at'-'cancelled_by') is distinct from (to_jsonb(old)-'cancelled_at'-'cancelled_by') then raise exception 'SCHEDULE_INVALID'; end if;
                                                                         else
                                                                            if new.cancelled_at is not null or new.cancelled_by is not null then raise exception 'SCHEDULE_INVALID'; end if;
                                                                             end if;
                                                                              perform 1 from public.staff where id=new.staff_id and biz_id=new.biz_id for update;
                                                                               if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
                                                                                if tg_op='UPDATE' then return new; end if;
                                                                                 if new.date_from is null or new.date_to is null or new.date_to<new.date_from then raise exception 'SCHEDULE_INVALID'; end if;
                                                                                  if exists(select 1 from public.staff_time_off t where t.staff_id=new.staff_id and t.biz_id=new.biz_id and t.cancelled_at is null and t.date_from<=new.date_to and t.date_to>=new.date_from) then raise exception 'SCHEDULE_ABSENCE_OVERLAP'; end if;
                                                                                   select coalesce(tz,'Asia/Bishkek') into business_tz from public.businesses where id=new.biz_id;
                                                                                    if exists(select 1 from public.bookings b where b.staff_id=new.staff_id and b.biz_id=new.biz_id and (b.status::text in ('confirmed','paid') or (b.status::text='hold' and b.expires_at>now())) and b.end_at>now() and b.start_at<((new.date_to+1)::timestamp at time zone business_tz) and b.end_at>(new.date_from::timestamp at time zone business_tz)) then raise exception 'SCHEDULE_BOOKING_CONFLICT'; end if;
                                                                                     return new;
                                                                                     end $$;


ALTER FUNCTION "public"."guard_staff_absence_booking"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_staff_home_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    if new.branch_id is distinct from old.branch_id and not exists(
        select 1 from public.staff_home_branch_changes c where c.staff_id=old.id
        and c.from_branch_id is not distinct from old.branch_id and c.to_branch_id=new.branch_id
        and c.transaction_id=txid_current()) then raise exception 'SCHEDULE_USE_TRANSFER_COMMAND'; end if;
    return new;
end;
$$;


ALTER FUNCTION "public"."guard_staff_home_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_branch_admin"("p_branch_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
       -- владелец бизнеса всегда проходит
       exists (
         select 1
         from public.businesses bb
         join public.branches br on br.biz_id = bb.id
         where br.id = p_branch_id
           and bb.owner_id = auth.uid()
       )
    or -- бизнес-админ тоже проходит (админ уровня бизнеса)
       exists (
         select 1
         from public.user_roles ur
         join public.roles r on r.id = ur.role_id
         join public.branches br on br.id = p_branch_id
         where ur.user_id = auth.uid()
           and r.key = 'admin'
           and ur.biz_id = br.biz_id
       )
    or -- конкретный админ этого филиала
       exists (
         select 1
         from public.branch_admins ba
         where ba.branch_id = p_branch_id
           and ba.user_id   = auth.uid()
       );
$$;


ALTER FUNCTION "public"."has_branch_admin"("p_branch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("p_role_key" "text", "p_biz_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists(
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.key = p_role_key
      and (p_biz_id is null and ur.biz_id is null or ur.biz_id = p_biz_id)
  );
$$;


ALTER FUNCTION "public"."has_role"("p_role_key" "text", "p_biz_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("p_biz_id" "uuid", "p_roles" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    is_super_admin()
    or exists (
      select 1 from user_roles
      where user_id = auth.uid()
        and biz_id  = p_biz_id
        and role = any(p_roles)
    );
$$;


ALTER FUNCTION "public"."has_role"("p_biz_id" "uuid", "p_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = p_user_id
      and ur.biz_id  = p_biz_id
      and r.key = p_role_key
  );
$$;


ALTER FUNCTION "public"."has_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hold_complex_slot"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_booking_id uuid;
    v_expires_at timestamptz;
    v_client_id uuid;
    v_client_name text;
    v_client_phone text;
    v_client_email text;
    v_total_duration_min integer := 0;
    v_item jsonb;
    v_service_id uuid;
    v_duration_min integer;
    v_order_index integer;
    v_index integer := 0;
    v_end timestamptz;
begin
    -- Текущий пользователь
    v_client_id := auth.uid();
    if v_client_id is null then
        raise exception 'User must be authenticated';
    end if;

    -- Данные клиента из профиля
    select p.full_name, p.phone, u.email
    into v_client_name, v_client_phone, v_client_email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = v_client_id;

    if not found then
        raise exception 'User profile not found';
    end if;

    -- Проверка филиала
    if not exists (
        select 1
        from public.branches
        where id = p_branch_id
          and biz_id = p_biz_id
          and is_active = true
    ) then
        raise exception 'branch not found or inactive';
    end if;

    -- Проверка мастера
    if not exists (
        select 1
        from public.staff
        where id = p_staff_id
          and biz_id = p_biz_id
          and (branch_id = p_branch_id or exists (select 1 from public.staff_schedule_versions v where v.staff_id = p_staff_id))
          and is_active = true
    ) then
        raise exception 'staff not found or inactive';
    end if;

    -- Валидация и суммирование услуг
    if p_services is null or jsonb_typeof(p_services) <> 'array' or jsonb_array_length(p_services) = 0 then
        raise exception 'services array must be a non-empty JSON array';
    end if;

    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;

        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        if v_service_id is null then
            raise exception 'service_id is required in services[%]', v_index;
        end if;
        if v_duration_min is null or v_duration_min <= 0 then
            raise exception 'duration_min must be positive in services[%]', v_index;
        end if;

        -- Проверяем, что услуга существует и активна в этом бизнесе
        if not exists (
            select 1
            from public.services s
            where s.id = v_service_id
              and s.biz_id = p_biz_id
              and s.active = true
        ) then
            raise exception 'service not found or inactive: %', v_service_id;
        end if;

        v_total_duration_min := v_total_duration_min + v_duration_min;
    end loop;

    if v_total_duration_min <= 0 then
        raise exception 'total duration must be positive';
    end if;

    v_end := p_start + (v_total_duration_min || ' minutes')::interval;

    -- Время истечения резерва (2 минуты)
    v_expires_at := now() + interval '2 minutes';

    -- Проверка пересечений с существующими бронированиями
    if exists (
        select 1
        from public.bookings
        where staff_id = p_staff_id
          and (status in ('confirmed','paid') or (status = 'hold' and expires_at > now()))
          and tstzrange(start_at, end_at, '[)') && tstzrange(p_start, v_end, '[)')
    ) then
        raise exception 'time slot is already booked';
    end if;

    -- Создаём бронирование (service_id = первая услуга комплекса)
    insert into public.bookings (
        biz_id,
        branch_id,
        service_id,
        staff_id,
        client_id,
        client_name,
        client_phone,
        client_email,
        start_at,
        end_at,
        status,
        expires_at
    )
    values (
        p_biz_id,
        p_branch_id,
        (p_services->0->>'service_id')::uuid,
        p_staff_id,
        v_client_id,
        v_client_name,
        v_client_phone,
        v_client_email,
        p_start,
        v_end,
        'hold'::booking_status,
        v_expires_at
    )
    returning id into v_booking_id;

    -- Заполняем booking_services
    v_index := 0;
    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        insert into public.booking_services (
            booking_id,
            service_id,
            duration_min,
            order_index
        )
        values (
            v_booking_id,
            v_service_id,
            v_duration_min,
            v_order_index
        );
    end loop;

    return v_booking_id;
end;
$$;


ALTER FUNCTION "public"."hold_complex_slot"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hold_complex_slot"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb") IS 'Создаёт бронирование со статусом hold для комплексов услуг (несколько услуг за один визит) и заполняет booking_services.';



CREATE OR REPLACE FUNCTION "public"."hold_complex_slot_guest"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb", "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_booking_id uuid;
    v_expires_at timestamptz;
    v_total_duration_min integer := 0;
    v_item jsonb;
    v_service_id uuid;
    v_duration_min integer;
    v_order_index integer;
    v_index integer := 0;
    v_end timestamptz;
    v_client_name_trimmed text;
    v_client_phone_trimmed text;
    v_client_email_trimmed text;
begin
    if p_client_name is null or trim(p_client_name) = '' then
        raise exception 'client_name is required';
    end if;
    if p_client_phone is null or trim(p_client_phone) = '' then
        raise exception 'client_phone is required';
    end if;

    v_client_name_trimmed := trim(p_client_name);
    v_client_phone_trimmed := trim(p_client_phone);
    v_client_email_trimmed := case when p_client_email is not null then trim(p_client_email) else null end;

    if not exists (
        select 1 from public.branches
        where id = p_branch_id and biz_id = p_biz_id and is_active = true
    ) then
        raise exception 'branch not found or inactive';
    end if;

    if not exists (
        select 1 from public.staff
        where id = p_staff_id and biz_id = p_biz_id and (branch_id = p_branch_id or exists (select 1 from public.staff_schedule_versions v where v.staff_id = p_staff_id)) and is_active = true
    ) then
        raise exception 'staff not found or inactive';
    end if;

    if p_services is null or jsonb_typeof(p_services) <> 'array' or jsonb_array_length(p_services) = 0 then
        raise exception 'services array must be a non-empty JSON array';
    end if;

    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        if v_service_id is null then
            raise exception 'service_id is required in services[%]', v_index;
        end if;
        if v_duration_min is null or v_duration_min <= 0 then
            raise exception 'duration_min must be positive in services[%]', v_index;
        end if;

        if not exists (
            select 1 from public.services s
            where s.id = v_service_id and s.biz_id = p_biz_id and s.active = true
        ) then
            raise exception 'service not found or inactive: %', v_service_id;
        end if;

        v_total_duration_min := v_total_duration_min + v_duration_min;
    end loop;

    if v_total_duration_min <= 0 then
        raise exception 'total duration must be positive';
    end if;

    v_end := p_start + (v_total_duration_min || ' minutes')::interval;
    v_expires_at := now() + interval '2 minutes';

    if exists (
        select 1 from public.bookings
        where staff_id = p_staff_id
          and (status in ('confirmed','paid') or (status = 'hold' and expires_at > now()))
          and tstzrange(start_at, end_at, '[)') && tstzrange(p_start, v_end, '[)')
    ) then
        raise exception 'time slot is already booked';
    end if;

    insert into public.bookings (
        biz_id, branch_id, service_id, staff_id,
        client_id, client_name, client_phone, client_email,
        start_at, end_at, status, expires_at
    )
    values (
        p_biz_id, p_branch_id, (p_services->0->>'service_id')::uuid, p_staff_id,
        null, v_client_name_trimmed, v_client_phone_trimmed, v_client_email_trimmed,
        p_start, v_end, 'hold'::booking_status, v_expires_at
    )
    returning id into v_booking_id;

    v_index := 0;
    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        insert into public.booking_services (booking_id, service_id, duration_min, order_index)
        values (v_booking_id, v_service_id, v_duration_min, v_order_index);
    end loop;

    return v_booking_id;
end;
$$;


ALTER FUNCTION "public"."hold_complex_slot_guest"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb", "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hold_complex_slot_guest"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb", "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") IS 'Создаёт гостевую бронь (без авторизации) для комплекса услуг и заполняет booking_services.';



CREATE OR REPLACE FUNCTION "public"."hold_slot"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_client_id uuid;
    v_client_name text;
    v_client_phone text;
    v_client_email text;
    v_service_duration_min int;
    v_end timestamptz;
    v_booking_id uuid;
begin
    v_client_id := auth.uid();
    if v_client_id is null then
        raise exception 'User must be authenticated';
    end if;

    select coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.email),
           coalesce(p.phone, u.phone), u.email
    into v_client_name, v_client_phone, v_client_email
    from auth.users u left join public.profiles p on p.id = u.id
    where u.id = v_client_id;
    if not found then raise exception 'User not found'; end if;

    if not exists (select 1 from public.profiles where id = v_client_id) then
        insert into public.profiles (id, full_name, phone)
        values (v_client_id, coalesce(v_client_name, 'Пользователь'), v_client_phone)
        on conflict (id) do nothing;
    end if;

    select duration_min into v_service_duration_min
    from public.services
    where id = p_service_id and biz_id = p_biz_id and active = true;
    if not found then raise exception 'service not found or inactive'; end if;

    if not exists (select 1 from public.staff
        where id = p_staff_id and biz_id = p_biz_id and is_active = true)
    then raise exception 'staff not found or inactive'; end if;

    if not exists (select 1 from public.branches
        where id = p_branch_id and biz_id = p_biz_id and is_active = true)
    then raise exception 'branch not found or inactive'; end if;

    v_end := p_start + (v_service_duration_min || ' minutes')::interval;
    if not public.schedule_contains_booking(p_staff_id, p_branch_id, p_start, v_end)
    then raise exception 'SCHEDULE_OUTSIDE_WORKING_HOURS'; end if;

    if exists (select 1 from public.bookings
        where staff_id = p_staff_id and status in ('confirmed', 'paid')
        and tstzrange(start_at, end_at, '[)') && tstzrange(p_start, v_end, '[)'))
    then raise exception 'time slot is already booked'; end if;

    insert into public.bookings (
        biz_id, branch_id, service_id, staff_id, client_id,
        client_name, client_phone, client_email, start_at, end_at, status, expires_at
    ) values (
        p_biz_id, p_branch_id, p_service_id, p_staff_id, v_client_id,
        v_client_name, v_client_phone, v_client_email, p_start, v_end,
        'confirmed'::booking_status, null
    ) returning id into v_booking_id;
    return v_booking_id;
end;
$$;


ALTER FUNCTION "public"."hold_slot"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hold_slot"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone) IS 'Authenticated single-service booking: current user contacts, effective schedule work location, breaks and absences; confirmed immediately. Existing serialized booking trigger protects conflicts.';



CREATE OR REPLACE FUNCTION "public"."hold_slot_guest"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_service_duration_min int;
  v_end timestamptz;
  v_expires_at timestamptz;
  v_booking_id uuid;
  v_client_name_trimmed text;
  v_client_phone_trimmed text;
  v_client_email_trimmed text;
begin
  if p_client_name is null or trim(p_client_name)='' then
    raise exception 'client_name is required';
  end if;
  if p_client_phone is null or trim(p_client_phone)='' then
    raise exception 'client_phone is required';
  end if;
  v_client_name_trimmed:=trim(p_client_name);
  v_client_phone_trimmed:=trim(p_client_phone);
  v_client_email_trimmed:=case when p_client_email is not null then trim(p_client_email) else null end;
  select duration_min into v_service_duration_min from public.services
    where id=p_service_id and biz_id=p_biz_id and active=true;
  if not found then raise exception 'service not found or inactive'; end if;
  if not exists(select 1 from public.staff where id=p_staff_id and biz_id=p_biz_id and is_active=true) then
    raise exception 'staff not found or inactive';
  end if;
  if not exists(select 1 from public.branches where id=p_branch_id and biz_id=p_biz_id and is_active=true) then
    raise exception 'branch not found or inactive';
  end if;
  v_end:=p_start+(v_service_duration_min||' minutes')::interval;
  if not public.schedule_contains_booking(p_staff_id,p_branch_id,p_start,v_end) then
    raise exception 'SCHEDULE_OUTSIDE_WORKING_HOURS';
  end if;
  v_expires_at:=now()+interval '2 minutes';
  if exists(
    select 1 from public.bookings where staff_id=p_staff_id and status in('confirmed','paid')
      and tstzrange(start_at,end_at,'[)')&&tstzrange(p_start,v_end,'[)')
    union all
    select 1 from public.bookings where staff_id=p_staff_id and status='hold'
      and (expires_at is null or expires_at>=now())
      and tstzrange(start_at,end_at,'[)')&&tstzrange(p_start,v_end,'[)')
  ) then raise exception 'time slot is already booked'; end if;
  insert into public.bookings(biz_id,branch_id,service_id,staff_id,client_id,
    client_name,client_phone,client_email,start_at,end_at,status,expires_at)
  values(p_biz_id,p_branch_id,p_service_id,p_staff_id,null,
    v_client_name_trimmed,v_client_phone_trimmed,v_client_email_trimmed,p_start,v_end,
    'hold'::booking_status,v_expires_at)
  returning id into v_booking_id;
  return v_booking_id;
end;
$$;


ALTER FUNCTION "public"."hold_slot_guest"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."hold_slot_guest"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") IS 'Создает гостевую бронь без авторизации. Исключает истекшие hold бронирования при проверке пересечений. Возвращает ID созданной брони.';



CREATE OR REPLACE FUNCTION "public"."initialize_all_ratings"("p_days_back" integer DEFAULT 30) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
    v_config public.rating_global_config;
    v_start_date date;
    v_end_date date;
    r_staff record;
    r_branch record;
    r_biz record;
    v_staff_rating numeric;
    v_branch_rating numeric;
    v_biz_rating numeric;
    v_default_rating numeric := 50.0; -- Стартовый рейтинг для новых бизнесов
begin
    raise notice 'Starting rating initialization (last % days)', p_days_back;
    
    -- Получаем активную конфигурацию
    select * into v_config
    from public.rating_global_config
    where is_active = true
    order by valid_from desc
    limit 1;
    
    if v_config is null then
        raise exception 'No active rating configuration found';
    end if;
    
    -- Определяем диапазон дат для пересчета
    v_end_date := timezone('Asia/Bishkek', now())::date - interval '1 day'; -- Вчера
    v_start_date := v_end_date - (p_days_back || ' days')::interval;
    
    raise notice 'Recalculating metrics from % to %', v_start_date, v_end_date;
    
    -- Пересчитываем метрики за весь диапазон
    perform public.recalculate_ratings_for_date_range(v_start_date, v_end_date);
    
    raise notice 'Updating aggregated ratings...';
    
    -- 4. Обновляем агрегированные рейтинги в таблицах staff, branches, businesses
    for r_staff in select id from public.staff loop
        begin
            v_staff_rating := public.calculate_staff_rating(r_staff.id);
            -- Если рейтинг NULL или 0, устанавливаем начальный рейтинг
            if v_staff_rating is null or v_staff_rating = 0 then
                v_staff_rating := v_default_rating;
            end if;
            update public.staff set rating_score = v_staff_rating where id = r_staff.id;
        exception when others then
            raise notice 'Error updating staff rating for staff_id=%: %', r_staff.id, SQLERRM;
            -- Устанавливаем минимальный рейтинг при ошибке
            update public.staff set rating_score = v_default_rating where id = r_staff.id and (rating_score is null or rating_score = 0);
        end;
    end loop;

    for r_branch in select id from public.branches loop
        begin
            v_branch_rating := public.calculate_branch_rating(r_branch.id);
            -- Если рейтинг NULL или 0, рассчитываем как средний рейтинг сотрудников
            if v_branch_rating is null or v_branch_rating = 0 then
                select coalesce(avg(rating_score), v_default_rating) into v_branch_rating
                from public.staff
                where branch_id = r_branch.id and is_active = true;
            end if;
            update public.branches set rating_score = v_branch_rating where id = r_branch.id;
        exception when others then
            raise notice 'Error updating branch rating for branch_id=%: %', r_branch.id, SQLERRM;
            -- Устанавливаем минимальный рейтинг при ошибке
            update public.branches set rating_score = v_default_rating where id = r_branch.id and (rating_score is null or rating_score = 0);
        end;
    end loop;

    for r_biz in select id from public.businesses loop
        begin
            v_biz_rating := public.calculate_biz_rating(r_biz.id);
            -- Если рейтинг NULL или 0, рассчитываем как средний рейтинг филиалов
            if v_biz_rating is null or v_biz_rating = 0 then
                select coalesce(avg(rating_score), v_default_rating) into v_biz_rating
                from public.branches
                where biz_id = r_biz.id and is_active = true;
            end if;
            update public.businesses set rating_score = v_biz_rating where id = r_biz.id;
        exception when others then
            raise notice 'Error updating biz rating for biz_id=%: %', r_biz.id, SQLERRM;
            -- Устанавливаем минимальный рейтинг при ошибке
            update public.businesses set rating_score = v_default_rating where id = r_biz.id and (rating_score is null or rating_score = 0);
        end;
    end loop;
    
    raise notice 'Rating initialization completed';
end;
$$;


ALTER FUNCTION "public"."initialize_all_ratings"("p_days_back" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."initialize_all_ratings"("p_days_back" integer) IS 'Инициализирует рейтинги для всех бизнесов, филиалов и сотрудников. Пересчитывает метрики за последние N дней и устанавливает начальные рейтинги.';



CREATE OR REPLACE FUNCTION "public"."initialize_shift_aggregates"("p_staff_id" "uuid" DEFAULT NULL::"uuid", "p_biz_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_count integer := 0;
    v_shift record;
    v_final_master numeric;
    v_final_salon numeric;
begin
    -- Пересчитываем агрегаты для всех закрытых смен
    -- Если указан p_staff_id, пересчитываем только для этого сотрудника
    -- Если указан p_biz_id, пересчитываем только для этого бизнеса
    for v_shift in
        select 
            s.id,
            s.staff_id,
            s.biz_id,
            s.shift_date,
            s.total_amount,
            s.master_share,
            s.salon_share,
            s.late_minutes,
            coalesce(s.guaranteed_amount, 0) as guaranteed_amount,
            coalesce(s.topup_amount, 0) as topup_amount
        from public.staff_shifts s
        where s.status = 'closed'
          and (p_staff_id is null or s.staff_id = p_staff_id)
          and (p_biz_id is null or s.biz_id = p_biz_id)
        order by s.shift_date
    loop
        -- Вычисляем финальные суммы (как в useShiftStats)
        v_final_master := greatest(v_shift.guaranteed_amount, v_shift.master_share);
        v_final_salon := v_shift.salon_share - v_shift.topup_amount;
        
        -- Обновляем агрегаты
        perform public.update_shift_aggregates(
            v_shift.staff_id,
            v_shift.biz_id,
            v_shift.shift_date,
            v_shift.total_amount,
            v_shift.master_share,
            v_shift.salon_share,
            coalesce(v_shift.late_minutes, 0),
            v_shift.guaranteed_amount,
            v_shift.topup_amount
        );
        
        v_count := v_count + 1;
    end loop;
    
    return v_count;
end;
$$;


ALTER FUNCTION "public"."initialize_shift_aggregates"("p_staff_id" "uuid", "p_biz_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."initialize_shift_aggregates"("p_staff_id" "uuid", "p_biz_id" "uuid") IS 'Инициализирует агрегаты статистики из существующих закрытых смен. Можно указать staff_id или biz_id для ограничения области пересчета.';



CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    -- канонично: глобальные роли платформы
    exists (
      select 1
      from public.user_global_roles ugr
      join public.roles r on r.id = ugr.role_id
      where ugr.user_id = auth.uid()
        and r.scope = 'platform'
        and r.key   = 'super_admin'
    )
    -- легаси: старая таблица, если использовалась
    or exists (
      select 1
      from public.super_admins_legacy l
      where l.user_id = auth.uid()
    );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_api_metric"("p_endpoint" "text", "p_method" "text", "p_status_code" integer, "p_duration_ms" integer, "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_staff_id" "uuid" DEFAULT NULL::"uuid", "p_biz_id" "uuid" DEFAULT NULL::"uuid", "p_error_message" "text" DEFAULT NULL::"text", "p_error_type" "text" DEFAULT NULL::"text", "p_request_size_bytes" integer DEFAULT NULL::integer, "p_response_size_bytes" integer DEFAULT NULL::integer, "p_metadata" "jsonb" DEFAULT NULL::"jsonb", "p_ip_address" "inet" DEFAULT NULL::"inet", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_metric_id uuid;
begin
    -- Валидация статус кода
    if p_status_code < 100 or p_status_code >= 600 then
        raise exception 'Invalid status_code: %', p_status_code;
    end if;
    
    -- Валидация типа ошибки
    if p_error_type is not null and p_error_type not in ('validation', 'database', 'auth', 'server', 'network') then
        raise exception 'Invalid error_type: %', p_error_type;
    end if;
    
    -- Вставляем метрику
    insert into public.api_request_metrics (
        endpoint,
        method,
        status_code,
        duration_ms,
        user_id,
        staff_id,
        biz_id,
        error_message,
        error_type,
        request_size_bytes,
        response_size_bytes,
        metadata,
        ip_address,
        user_agent
    )
    values (
        p_endpoint,
        p_method,
        p_status_code,
        p_duration_ms,
        p_user_id,
        p_staff_id,
        p_biz_id,
        p_error_message,
        p_error_type,
        p_request_size_bytes,
        p_response_size_bytes,
        p_metadata,
        p_ip_address,
        p_user_agent
    )
    returning id into v_metric_id;
    
    return v_metric_id;
end;
$$;


ALTER FUNCTION "public"."log_api_metric"("p_endpoint" "text", "p_method" "text", "p_status_code" integer, "p_duration_ms" integer, "p_user_id" "uuid", "p_staff_id" "uuid", "p_biz_id" "uuid", "p_error_message" "text", "p_error_type" "text", "p_request_size_bytes" integer, "p_response_size_bytes" integer, "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_api_metric"("p_endpoint" "text", "p_method" "text", "p_status_code" integer, "p_duration_ms" integer, "p_user_id" "uuid", "p_staff_id" "uuid", "p_biz_id" "uuid", "p_error_message" "text", "p_error_type" "text", "p_request_size_bytes" integer, "p_response_size_bytes" integer, "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") IS 'Записывает метрику API запроса в таблицу метрик. Возвращает ID созданной метрики.';



CREATE OR REPLACE FUNCTION "public"."log_booking_analytics_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    -- Логируем создание бронирования
    if tg_op = 'INSERT' then
        insert into public.analytics_events (
            event_type,
            biz_id,
            branch_id,
            booking_id,
            client_id,
            source,
            session_id,
            metadata
        )
        values (
            'booking_created',
            new.biz_id,
            new.branch_id,
            new.id,
            new.client_id,
            coalesce(current_setting('app.booking_source', true), 'system'),
            null,
            jsonb_build_object(
                'status', new.status
            )
        );
        return new;
    end if;

    -- Логируем переход в confirmed/paid
    if tg_op = 'UPDATE' then
        -- Только если статус реально изменился
        if (old.status is distinct from new.status)
           and (new.status in ('confirmed', 'paid')) then
            insert into public.analytics_events (
                event_type,
                biz_id,
                branch_id,
                booking_id,
                client_id,
                source,
                session_id,
                metadata
            )
            values (
                'booking_confirmed_or_paid',
                new.biz_id,
                new.branch_id,
                new.id,
                new.client_id,
                coalesce(current_setting('app.booking_source', true), 'system'),
                null,
                jsonb_build_object(
                    'previous_status', old.status,
                    'status', new.status
                )
            );
        end if;
        return new;
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."log_booking_analytics_event"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_booking_analytics_event"() IS 'Триггер-функция: логирует события booking_created и booking_confirmed_or_paid в analytics_events.';



CREATE OR REPLACE FUNCTION "public"."log_finance_operation"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_operation_type" "text", "p_message" "text", "p_log_level" "text" DEFAULT 'info'::"text", "p_shift_id" "uuid" DEFAULT NULL::"uuid", "p_shift_date" "date" DEFAULT NULL::"date", "p_metadata" "jsonb" DEFAULT NULL::"jsonb", "p_before_data" "jsonb" DEFAULT NULL::"jsonb", "p_after_data" "jsonb" DEFAULT NULL::"jsonb", "p_error_message" "text" DEFAULT NULL::"text", "p_error_stack" "text" DEFAULT NULL::"text", "p_ip_address" "inet" DEFAULT NULL::"inet", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_log_id uuid;
begin
    -- Валидация типа операции
    if p_operation_type not in ('shift_open', 'shift_close', 'item_create', 'item_update', 'item_delete', 'items_save', 'error') then
        raise exception 'Invalid operation_type: %', p_operation_type;
    end if;
    
    -- Валидация уровня логирования
    if p_log_level not in ('debug', 'info', 'warn', 'error') then
        raise exception 'Invalid log_level: %', p_log_level;
    end if;
    
    -- Вставляем лог
    insert into public.staff_finance_operation_logs (
        staff_id,
        biz_id,
        shift_id,
        shift_date,
        operation_type,
        log_level,
        message,
        metadata,
        before_data,
        after_data,
        error_message,
        error_stack,
        ip_address,
        user_agent
    )
    values (
        p_staff_id,
        p_biz_id,
        p_shift_id,
        p_shift_date,
        p_operation_type,
        p_log_level,
        p_message,
        p_metadata,
        p_before_data,
        p_after_data,
        p_error_message,
        p_error_stack,
        p_ip_address,
        p_user_agent
    )
    returning id into v_log_id;
    
    return v_log_id;
end;
$$;


ALTER FUNCTION "public"."log_finance_operation"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_operation_type" "text", "p_message" "text", "p_log_level" "text", "p_shift_id" "uuid", "p_shift_date" "date", "p_metadata" "jsonb", "p_before_data" "jsonb", "p_after_data" "jsonb", "p_error_message" "text", "p_error_stack" "text", "p_ip_address" "inet", "p_user_agent" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_finance_operation"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_operation_type" "text", "p_message" "text", "p_log_level" "text", "p_shift_id" "uuid", "p_shift_date" "date", "p_metadata" "jsonb", "p_before_data" "jsonb", "p_after_data" "jsonb", "p_error_message" "text", "p_error_stack" "text", "p_ip_address" "inet", "p_user_agent" "text") IS 'Записывает лог операции с финансами в таблицу логов. Возвращает ID созданного лога.';



CREATE OR REPLACE FUNCTION "public"."log_frontend_metric"("p_metric_type" "text", "p_metric_data" "jsonb", "p_timestamp" timestamp with time zone DEFAULT "now"(), "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_page" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text", "p_ip_address" "inet" DEFAULT NULL::"inet") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_metric_id UUID;
    v_page TEXT;
BEGIN
    -- Извлекаем page из метрики, если не указан явно
    IF p_page IS NULL THEN
        v_page := p_metric_data->>'page';
        IF v_page IS NULL THEN
            v_page := p_metric_data->>'url';
        END IF;
    ELSE
        v_page := p_page;
    END IF;

    -- Вставляем метрику
    INSERT INTO frontend_metrics (
        metric_type,
        metric_data,
        created_at,
        user_id,
        page,
        user_agent,
        ip_address
    ) VALUES (
        p_metric_type,
        p_metric_data,
        p_timestamp,
        p_user_id,
        v_page,
        p_user_agent,
        p_ip_address
    )
    RETURNING id INTO v_metric_id;

    RETURN v_metric_id;
END;
$$;


ALTER FUNCTION "public"."log_frontend_metric"("p_metric_type" "text", "p_metric_data" "jsonb", "p_timestamp" timestamp with time zone, "p_user_id" "uuid", "p_page" "text", "p_user_agent" "text", "p_ip_address" "inet") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_frontend_metric"("p_metric_type" "text", "p_metric_data" "jsonb", "p_timestamp" timestamp with time zone, "p_user_id" "uuid", "p_page" "text", "p_user_agent" "text", "p_ip_address" "inet") IS 'Функция для логирования метрик производительности фронтенда';



CREATE OR REPLACE FUNCTION "public"."log_shift_close_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    -- Логируем только если статус изменился на 'closed'
    if new.status = 'closed' and old.status = 'open' then
        perform public.log_finance_operation(
            new.staff_id,
            new.biz_id,
            'shift_close',
            format('Смена закрыта для сотрудника %s на дату %s', new.staff_id, new.shift_date),
            'info',
            new.id,
            new.shift_date,
            jsonb_build_object(
                'closed_at', new.closed_at,
                'total_amount', new.total_amount,
                'consumables_amount', new.consumables_amount,
                'master_share', new.master_share,
                'salon_share', new.salon_share,
                'guaranteed_amount', new.guaranteed_amount,
                'topup_amount', new.topup_amount,
                'hours_worked', new.hours_worked
            ),
            jsonb_build_object(
                'id', old.id,
                'status', old.status,
                'opened_at', old.opened_at
            ), -- before_data
            jsonb_build_object(
                'id', new.id,
                'status', new.status,
                'closed_at', new.closed_at,
                'total_amount', new.total_amount,
                'master_share', new.master_share,
                'salon_share', new.salon_share
            ) -- after_data
        );
    end if;
    
    return new;
end;
$$;


ALTER FUNCTION "public"."log_shift_close_trigger"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_shift_close_trigger"() IS 'Автоматически логирует закрытие смены';



CREATE OR REPLACE FUNCTION "public"."log_shift_items_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
    v_shift_record record;
    v_operation_type text;
    v_message text;
begin
    -- Получаем информацию о смене
    select staff_id, biz_id, shift_date, id
    into v_shift_record
    from public.staff_shifts
    where id = coalesce(new.shift_id, old.shift_id);
    
    if v_shift_record is null then
        return coalesce(new, old);
    end if;
    
    -- Определяем тип операции
    if tg_op = 'INSERT' then
        v_operation_type := 'item_create';
        v_message := format('Создана позиция смены: клиент "%s", услуга "%s", сумма %s', 
            coalesce(new.client_name, 'не указан'),
            coalesce(new.service_name, 'не указана'),
            new.service_amount
        );
        
        perform public.log_finance_operation(
            v_shift_record.staff_id,
            v_shift_record.biz_id,
            v_operation_type,
            v_message,
            'info',
            v_shift_record.id,
            v_shift_record.shift_date,
            jsonb_build_object(
                'item_id', new.id,
                'client_name', new.client_name,
                'service_name', new.service_name,
                'service_amount', new.service_amount,
                'consumables_amount', new.consumables_amount,
                'booking_id', new.booking_id
            ),
            null, -- before_data
            jsonb_build_object(
                'id', new.id,
                'client_name', new.client_name,
                'service_amount', new.service_amount
            ) -- after_data
        );
    elsif tg_op = 'DELETE' then
        v_operation_type := 'item_delete';
        v_message := format('Удалена позиция смены: клиент "%s", услуга "%s", сумма %s', 
            coalesce(old.client_name, 'не указан'),
            coalesce(old.service_name, 'не указана'),
            old.service_amount
        );
        
        perform public.log_finance_operation(
            v_shift_record.staff_id,
            v_shift_record.biz_id,
            v_operation_type,
            v_message,
            'info',
            v_shift_record.id,
            v_shift_record.shift_date,
            jsonb_build_object(
                'item_id', old.id,
                'client_name', old.client_name,
                'service_name', old.service_name,
                'service_amount', old.service_amount
            ),
            jsonb_build_object(
                'id', old.id,
                'client_name', old.client_name,
                'service_amount', old.service_amount
            ), -- before_data
            null -- after_data
        );
    elsif tg_op = 'UPDATE' then
        v_operation_type := 'item_update';
        v_message := format('Обновлена позиция смены: клиент "%s"', 
            coalesce(new.client_name, 'не указан')
        );
        
        perform public.log_finance_operation(
            v_shift_record.staff_id,
            v_shift_record.biz_id,
            v_operation_type,
            v_message,
            'info',
            v_shift_record.id,
            v_shift_record.shift_date,
            jsonb_build_object(
                'item_id', new.id,
                'changes', jsonb_build_object(
                    'client_name', jsonb_build_object('old', old.client_name, 'new', new.client_name),
                    'service_name', jsonb_build_object('old', old.service_name, 'new', new.service_name),
                    'service_amount', jsonb_build_object('old', old.service_amount, 'new', new.service_amount),
                    'consumables_amount', jsonb_build_object('old', old.consumables_amount, 'new', new.consumables_amount)
                )
            ),
            jsonb_build_object(
                'id', old.id,
                'client_name', old.client_name,
                'service_amount', old.service_amount
            ), -- before_data
            jsonb_build_object(
                'id', new.id,
                'client_name', new.client_name,
                'service_amount', new.service_amount
            ) -- after_data
        );
    end if;
    
    return coalesce(new, old);
end;
$$;


ALTER FUNCTION "public"."log_shift_items_trigger"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_shift_items_trigger"() IS 'Автоматически логирует создание, обновление и удаление позиций смены';



CREATE OR REPLACE FUNCTION "public"."log_shift_open_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    -- Логируем при INSERT с status='open' или при UPDATE когда статус сменился на 'open'.
    -- При INSERT OLD не определён — не обращаемся к OLD.
    if new.status = 'open' and (TG_OP = 'INSERT' or old.status != 'open') then
        perform public.log_finance_operation(
            new.staff_id,
            new.biz_id,
            'shift_open',
            format('Смена открыта для сотрудника %s на дату %s', new.staff_id, new.shift_date),
            'info',
            new.id,
            new.shift_date,
            jsonb_build_object(
                'opened_at', new.opened_at,
                'expected_start', new.expected_start,
                'late_minutes', new.late_minutes
            ),
            null, -- before_data
            jsonb_build_object(
                'id', new.id,
                'status', new.status,
                'opened_at', new.opened_at,
                'shift_date', new.shift_date
            ) -- after_data
        );
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."log_shift_open_trigger"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_shift_open_trigger"() IS 'Автоматически логирует открытие смены (INSERT или смена статуса на open).';



CREATE OR REPLACE FUNCTION "public"."members_of_biz"("p_biz_id" "uuid") RETURNS TABLE("user_id" "uuid", "email" "text", "phone" "text", "full_name" "text", "roles" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- доступ: глобальный супер или владелец/админ конкретного бизнеса
  if not ( public.is_super_admin()
           or public.has_role('owner'::text, p_biz_id)
           or public.has_role('admin'::text, p_biz_id) ) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  return query
  select
    u.user_id,
    u.email,
    u.phone,
    u.full_name,
    array_agg(distinct u.role_key order by u.role_key)::text[] as roles
  from public.user_roles_with_user u
  where u.biz_id = p_biz_id
  group by u.user_id, u.email, u.phone, u.full_name
  order by coalesce(u.full_name, u.email, u.phone, u.user_id::text);

end;
$$;


ALTER FUNCTION "public"."members_of_biz"("p_biz_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_role_keys"() RETURNS "text"[]
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with role_rows as (
    select r.key::text as rk               -- <== замени r.key на твоё поле (key/slug/name)
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
  ),
  owner_rows as (
    select 'owner'::text as rk
    from public.businesses b
    where b.owner_id = auth.uid()
  )
  select coalesce(array_agg(distinct rk), '{}')
  from (
    select rk from role_rows
    union all
    select rk from owner_rows
  ) x;
$$;


ALTER FUNCTION "public"."my_role_keys"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."open_staff_shift_safe"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_branch_id" "uuid", "p_shift_date" "date", "p_opened_at" timestamp with time zone, "p_expected_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_late_minutes" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
declare
    v_existing_id uuid;
    v_existing_status text;
    v_result jsonb;
begin
    -- Блокируем строку для данного сотрудника и даты (если существует)
    -- Используем SELECT FOR UPDATE для предотвращения race conditions
    select id, status
    into v_existing_id, v_existing_status
    from public.staff_shifts
    where staff_id = p_staff_id
      and shift_date = p_shift_date
    for update;

    -- Если смена уже существует
    if v_existing_id is not null then
        -- Если уже открыта - возвращаем существующую
        if v_existing_status = 'open' then
            select row_to_json(s)::jsonb
            into v_result
            from public.staff_shifts s
            where s.id = v_existing_id;
            
            return jsonb_build_object(
                'ok', true,
                'shift', v_result,
                'action', 'already_open'
            );
        end if;

        -- Если закрыта - переоткрываем (сохраняем opened_at и late_minutes)
        update public.staff_shifts
        set status = 'open',
            closed_at = null,
            total_amount = 0,
            consumables_amount = 0,
            master_share = 0,
            salon_share = 0,
            guaranteed_amount = 0,
            topup_amount = 0,
            hours_worked = null
        where id = v_existing_id
          and status = 'closed';  -- Проверяем статус в WHERE для безопасности

        -- Проверяем, что обновление прошло успешно
        if not found then
            return jsonb_build_object(
                'ok', false,
                'error', 'Смена была изменена другим запросом. Попробуйте снова.'
            );
        end if;

        -- Возвращаем обновленную смену
        select row_to_json(s)::jsonb
        into v_result
        from public.staff_shifts s
        where s.id = v_existing_id;
        
        return jsonb_build_object(
            'ok', true,
            'shift', v_result,
            'action', 'reopened'
        );
    end if;

    -- Смена не существует - создаем новую
    insert into public.staff_shifts (
        staff_id,
        biz_id,
        branch_id,
        shift_date,
        opened_at,
        expected_start,
        late_minutes,
        status
    )
    values (
        p_staff_id,
        p_biz_id,
        p_branch_id,
        p_shift_date,
        p_opened_at,
        p_expected_start,
        p_late_minutes,
        'open'
    )
    returning row_to_json(staff_shifts)::jsonb into v_result;

    return jsonb_build_object(
        'ok', true,
        'shift', v_result,
        'action', 'created'
    );

exception
    when unique_violation then
        -- Если все же произошло нарушение уникальности (очень редкий случай)
        -- Возвращаем существующую смену
        select row_to_json(s)::jsonb
        into v_result
        from public.staff_shifts s
        where s.staff_id = p_staff_id
          and s.shift_date = p_shift_date;
        
        if v_result is not null then
            return jsonb_build_object(
                'ok', true,
                'shift', v_result,
                'action', 'already_exists'
            );
        end if;
        
        return jsonb_build_object(
            'ok', false,
            'error', 'Не удалось создать смену из-за конфликта. Попробуйте снова.'
        );
    when others then
        return jsonb_build_object(
            'ok', false,
            'error', 'Ошибка при открытии смены: ' || sqlerrm
        );
end;
$$;


ALTER FUNCTION "public"."open_staff_shift_safe"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_branch_id" "uuid", "p_shift_date" "date", "p_opened_at" timestamp with time zone, "p_expected_start" timestamp with time zone, "p_late_minutes" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."open_staff_shift_safe"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_branch_id" "uuid", "p_shift_date" "date", "p_opened_at" timestamp with time zone, "p_expected_start" timestamp with time zone, "p_late_minutes" integer) IS 'Безопасное открытие смены с защитой от race conditions. Использует SELECT FOR UPDATE для блокировки.';



CREATE OR REPLACE FUNCTION "public"."prevent_application_for_existing_business"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
    if exists (
        select 1
        from public.businesses b
        where lower(regexp_replace(btrim(b.name), '[[:space:]]+', ' ', 'g'))
            = lower(regexp_replace(btrim(new.business_name), '[[:space:]]+', ' ', 'g'))
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'APPLICATION_POLICY:business_exists';
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."prevent_application_for_existing_business"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prevent_application_for_existing_business"() IS 'Prevents registration applications from creating a duplicate of an existing business.';



CREATE OR REPLACE FUNCTION "public"."prevent_owner_suspended"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.owner_id is not null
     and exists (select 1 from public.user_suspensions where user_id = new.owner_id) then
    raise exception 'USER_SUSPENDED';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_owner_suspended"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_roles_for_suspended"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if exists (select 1 from public.user_suspensions where user_id = new.user_id) then
    raise exception 'USER_SUSPENDED';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_roles_for_suspended"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_staff_schedule"("p_staff" "uuid", "p_biz" "uuid", "p_actor" "uuid", "p_expected_revision" bigint, "p_kind" "text", "p_from" "date", "p_branch" "uuid", "p_days" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."publish_staff_schedule"("p_staff" "uuid", "p_biz" "uuid", "p_actor" "uuid", "p_expected_revision" bigint, "p_kind" "text", "p_from" "date", "p_branch" "uuid", "p_days" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_expired_holds"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update bookings
     set status='cancelled', expires_at = null
   where status='hold' and expires_at is not null and expires_at < now();
end $$;


ALTER FUNCTION "public"."purge_expired_holds"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_user"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- 1) Роли
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='user_roles') then
    delete from public.user_roles where user_id = p_user_id;
  end if;

  -- 2) Профиль (если PK=id=user_id)
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    delete from public.profiles where id = p_user_id;
  end if;

  -- 3) Сотрудники: оставляем карточки мастеров, отвязываем user_id
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='staff' and column_name='user_id'
  ) then
    update public.staff set user_id = null where user_id = p_user_id;
  end if;

  -- 4) Бронирования: сохраним бронь, отвяжем клиента
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='bookings' and column_name='client_id'
  ) then
    update public.bookings set client_id = null where client_id = p_user_id;
  end if;

  -- 5) Приглашения (если есть)
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='invitations') then
    update public.invitations set invited_user_id = null where invited_user_id = p_user_id;
    update public.invitations set sender_user_id  = null where sender_user_id  = p_user_id;
  end if;

  -- 6) Уведомления/логи (если есть)
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='notifications') then
    delete from public.notifications where user_id = p_user_id;
  end if;

  -- добавляй сюда любые свои таблицы с user_id по аналогии
end;
$$;


ALTER FUNCTION "public"."purge_user"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."read_staff_schedule"("p_staff" "uuid", "p_biz" "uuid", "p_from" "date", "p_to" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."read_staff_schedule"("p_staff" "uuid", "p_biz" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."read_staff_schedule_draft"("p_staff" "uuid", "p_biz" "uuid", "p_day" "date", "p_kind" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."read_staff_schedule_draft"("p_staff" "uuid", "p_biz" "uuid", "p_day" "date", "p_kind" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."read_staff_work_locations"("p_biz" "uuid", "p_from" "date", "p_to" "date") RETURNS TABLE("staff_id" "uuid", "branch_id" "uuid", "date_on" "date")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>62 then raise exception 'SCHEDULE_INVALID'; end if;
 return query select s.id,(d.value->>'branch_id')::uuid,p_from+i
 from public.staff s cross join generate_series(0,p_to-p_from) i
 cross join lateral (select public.schedule_effective_day(s.id,p_from+i) value) d
 where s.biz_id=p_biz and s.is_active and jsonb_array_length(d.value->'intervals')>0;
end;
$$;


ALTER FUNCTION "public"."read_staff_work_locations"("p_biz" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_ratings_for_date"("p_date" "date" DEFAULT (CURRENT_DATE - '1 day'::interval)) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    v_staff record;
    v_branch record;
    v_biz record;
begin
    -- Пересчитываем метрики для всех активных сотрудников за указанную дату
    for v_staff in
        select id from public.staff where is_active = true
    loop
        begin
            perform public.calculate_staff_day_metrics(v_staff.id, p_date);
        exception when others then
            insert into public.rating_recalc_errors (entity_id, entity_type, metric_date, error_message)
            values (v_staff.id, 'staff', p_date, SQLERRM);
            raise warning 'Error calculating metrics for staff %: %', v_staff.id, sqlerrm;
        end;
    end loop;

    for v_branch in
        select id from public.branches where is_active = true
    loop
        begin
            perform public.calculate_branch_day_metrics(v_branch.id, p_date);
        exception when others then
            insert into public.rating_recalc_errors (entity_id, entity_type, metric_date, error_message)
            values (v_branch.id, 'branch', p_date, SQLERRM);
            raise warning 'Error calculating metrics for branch %: %', v_branch.id, sqlerrm;
        end;
    end loop;

    for v_biz in
        select id from public.businesses where is_approved = true
    loop
        begin
            perform public.calculate_biz_day_metrics(v_biz.id, p_date);
        exception when others then
            insert into public.rating_recalc_errors (entity_id, entity_type, metric_date, error_message)
            values (v_biz.id, 'business', p_date, SQLERRM);
            raise warning 'Error calculating metrics for biz %: %', v_biz.id, sqlerrm;
        end;
    end loop;

    -- Пересчитываем агрегированные рейтинги
    for v_staff in
        select id from public.staff where is_active = true
    loop
        begin
            perform public.calculate_staff_rating(v_staff.id);
        exception when others then
            insert into public.rating_recalc_errors (entity_id, entity_type, metric_date, error_message)
            values (v_staff.id, 'staff', p_date, 'aggregate: ' || SQLERRM);
            raise warning 'Error calculating rating for staff %: %', v_staff.id, sqlerrm;
        end;
    end loop;

    for v_branch in
        select id from public.branches where is_active = true
    loop
        begin
            perform public.calculate_branch_rating(v_branch.id);
        exception when others then
            insert into public.rating_recalc_errors (entity_id, entity_type, metric_date, error_message)
            values (v_branch.id, 'branch', p_date, 'aggregate: ' || SQLERRM);
            raise warning 'Error calculating rating for branch %: %', v_branch.id, sqlerrm;
        end;
    end loop;

    for v_biz in
        select id from public.businesses where is_approved = true
    loop
        begin
            perform public.calculate_biz_rating(v_biz.id);
        exception when others then
            insert into public.rating_recalc_errors (entity_id, entity_type, metric_date, error_message)
            values (v_biz.id, 'business', p_date, 'aggregate: ' || SQLERRM);
            raise warning 'Error calculating rating for biz %: %', v_biz.id, sqlerrm;
        end;
    end loop;
end;
$$;


ALTER FUNCTION "public"."recalculate_ratings_for_date"("p_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."recalculate_ratings_for_date"("p_date" "date") IS 'Пересчитывает все рейтинги за указанную дату (по умолчанию вчера). Ошибки по сущностям пишет в rating_recalc_errors.';



CREATE OR REPLACE FUNCTION "public"."recalculate_ratings_for_date_range"("p_start_date" "date", "p_end_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
    v_current_date date;
    r_staff record;
    r_branch record;
    r_biz record;
begin
    raise notice 'Initializing ratings from % to %', p_start_date, p_end_date;
    
    -- Пересчитываем метрики за каждый день в диапазоне
    v_current_date := p_start_date;
    while v_current_date <= p_end_date loop
        raise notice 'Processing date: %', v_current_date;
        
        -- 1. Пересчитываем ежедневные метрики для всех сотрудников за эту дату
        for r_staff in select id, biz_id, branch_id from public.staff loop
            begin
                perform public.calculate_staff_day_metrics(r_staff.id, v_current_date);
            exception when others then
                raise notice 'Error calculating staff metrics for staff_id=%, date=%: %', r_staff.id, v_current_date, SQLERRM;
            end;
        end loop;

        -- 2. Пересчитываем ежедневные метрики для всех филиалов за эту дату
        for r_branch in select id, biz_id from public.branches loop
            begin
                perform public.calculate_branch_day_metrics(r_branch.id, v_current_date);
            exception when others then
                raise notice 'Error calculating branch metrics for branch_id=%, date=%: %', r_branch.id, v_current_date, SQLERRM;
            end;
        end loop;

        -- 3. Пересчитываем ежедневные метрики для всех бизнесов за эту дату
        for r_biz in select id from public.businesses loop
            begin
                perform public.calculate_biz_day_metrics(r_biz.id, v_current_date);
            exception when others then
                raise notice 'Error calculating biz metrics for biz_id=%, date=%: %', r_biz.id, v_current_date, SQLERRM;
            end;
        end loop;
        
        v_current_date := v_current_date + interval '1 day';
    end loop;
    
    raise notice 'Finished processing date range';
end;
$$;


ALTER FUNCTION "public"."recalculate_ratings_for_date_range"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."recalculate_ratings_for_date_range"("p_start_date" "date", "p_end_date" "date") IS 'Пересчитывает рейтинги за диапазон дат (для инициализации исторических данных)';



CREATE OR REPLACE FUNCTION "public"."reject_application_with_policy"("p_application_kind" "text", "p_application_id" "uuid", "p_reviewer_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text", "p_block_days" integer DEFAULT 0) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
    v_user_id uuid;
    v_phone text;
    v_biz_id uuid;
    v_role text;
    v_blocked_until timestamptz;
begin
    if p_block_days < 0 or p_block_days > 365 then
        raise exception using errcode = '22023', message = 'invalid block duration';
    end if;

    if p_application_kind = 'business_registration' then
        update public.business_registration_applications
           set status = 'rejected', reviewed_at = now(), reviewed_by = p_reviewer_user_id,
               review_note = nullif(btrim(p_reason), ''), updated_at = now()
         where id = p_application_id and status in ('new', 'contacted')
         returning applicant_user_id, phone into v_user_id, v_phone;
        if not found then return false; end if;
    elsif p_application_kind in ('owner', 'staff') then
        update public.business_role_applications
           set status = 'rejected', reviewed_at = now(), reviewed_by = p_reviewer_user_id,
               review_note = nullif(btrim(p_reason), ''), updated_at = now()
         where id = p_application_id and status = 'pending' and requested_role = p_application_kind
         returning applicant_user_id, biz_id, requested_role into v_user_id, v_biz_id, v_role;
        if not found then return false; end if;
    else
        raise exception using errcode = '22023', message = 'invalid application kind';
    end if;

    if p_block_days > 0 then
        v_blocked_until := now() + make_interval(days => p_block_days);
        insert into public.application_submission_blocks(
            application_kind, subject_user_id, subject_phone, biz_id,
            blocked_until, reason, created_by
        ) values (
            p_application_kind, v_user_id, case when v_user_id is null then v_phone else null end,
            v_biz_id, v_blocked_until, nullif(btrim(p_reason), ''), p_reviewer_user_id
        );
    end if;

    insert into public.application_moderation_actions(
        application_kind, application_id, action, actor_user_id,
        target_user_id, biz_id, reason, blocked_until
    ) values (
        p_application_kind, p_application_id,
        case when p_block_days > 0 then 'rejected_and_blocked' else 'rejected' end,
        p_reviewer_user_id, v_user_id, v_biz_id, nullif(btrim(p_reason), ''), v_blocked_until
    );
    return true;
end;
$$;


ALTER FUNCTION "public"."reject_application_with_policy"("p_application_kind" "text", "p_application_id" "uuid", "p_reviewer_user_id" "uuid", "p_reason" "text", "p_block_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_application_submission_block"("p_block_id" "uuid", "p_application_id" "uuid", "p_reviewer_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
    v_block public.application_submission_blocks%rowtype;
begin
    update public.application_submission_blocks
       set blocked_until = least(blocked_until, now()),
           released_at = now(),
           released_by = p_reviewer_user_id
     where id = p_block_id
       and blocked_until > now()
       and released_at is null
     returning * into v_block;

    if not found then return false; end if;

    insert into public.application_moderation_actions(
        application_kind, application_id, action, actor_user_id,
        target_user_id, biz_id, reason, metadata
    ) values (
        v_block.application_kind, p_application_id, 'unblocked', p_reviewer_user_id,
        v_block.subject_user_id, v_block.biz_id, 'Блокировка снята модератором',
        jsonb_build_object('block_id', v_block.id)
    );
    return true;
end;
$$;


ALTER FUNCTION "public"."release_application_submission_block"("p_block_id" "uuid", "p_application_id" "uuid", "p_reviewer_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_user_notification_email_source"("target_user_id" "uuid", "target_source" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    delete from public.user_notification_email_sources source
    using public.user_notification_emails email
    where source.email_id = email.id
      and email.user_id = target_user_id
      and source.source = target_source;

    delete from public.user_notification_emails email
    where email.user_id = target_user_id
      and not exists (
          select 1
          from public.user_notification_email_sources source
          where source.email_id = email.id
      );

    if not exists (
        select 1
        from public.user_notification_emails
        where user_id = target_user_id
          and enabled
          and verified
    ) then
        update public.user_notification_emails
        set enabled = true,
            updated_at = now()
        where id = (
            select id
            from public.user_notification_emails
            where user_id = target_user_id
              and verified
            order by created_at
            limit 1
        );
    end if;
end;
$$;


ALTER FUNCTION "public"."remove_user_notification_email_source"("target_user_id" "uuid", "target_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."replace_branch_schedule"("p_biz" "uuid", "p_branch" "uuid", "p_actor" "uuid", "p_days" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."replace_branch_schedule"("p_biz" "uuid", "p_branch" "uuid", "p_actor" "uuid", "p_days" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_staff_schedule_day"("p_staff" "uuid", "p_biz" "uuid", "p_actor" "uuid", "p_expected_revision" bigint, "p_day" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare target_branch uuid;
begin
 if not public.schedule_actor_can_manage(p_actor,p_biz) then raise exception 'SCHEDULE_FORBIDDEN'; end if;
 perform 1 from public.staff where id=p_staff and biz_id=p_biz and is_active for update;
 if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
 select branch_id into target_branch from public.staff_schedule_versions
 where staff_id=p_staff and kind='week' and effective_from<=p_day
 order by effective_from desc,revision desc limit 1;
 if not found then raise exception 'SCHEDULE_WEEK_REQUIRED'; end if;
 return public.publish_staff_schedule(p_staff,p_biz,p_actor,p_expected_revision,'day',p_day,target_branch,
   '{"day":{"intervals":[],"breaks":[],"use_regular":true}}'::jsonb);
end $$;


ALTER FUNCTION "public"."reset_staff_schedule_day"("p_staff" "uuid", "p_biz" "uuid", "p_actor" "uuid", "p_expected_revision" bigint, "p_day" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_staff_day"("p_staff_id" "uuid", "p_date" "date") RETURNS TABLE("branch_id" "uuid", "tz" "text", "intervals" "jsonb", "breaks" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."resolve_staff_day"("p_staff_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_staff_day_legacy"("p_staff_id" "uuid", "p_date" "date") RETURNS TABLE("branch_id" "uuid", "tz" "text", "intervals" "jsonb", "breaks" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
                                          declare v_row record; v_sched_found boolean:=false; v_biz uuid; v_branch uuid; v_tz text; v_intervals jsonb:='[]'::jsonb; v_breaks jsonb:='[]'::jsonb; dow int:=extract(dow from p_date);
                                          begin
                                           if exists(select 1 from public.staff_time_off t where t.staff_id=p_staff_id and t.cancelled_at is null and p_date between t.date_from and t.date_to) then return; end if;
                                            select st.biz_id,b.tz into v_biz,v_tz from public.staff st join public.businesses b on b.id=st.biz_id where st.id=p_staff_id;
                                             if v_biz is null then return; end if;
                                              for v_row in select * from public.staff_schedule_rules r where r.staff_id=p_staff_id and r.is_active and ((r.kind='date' and r.date_on=p_date) or (r.kind='range' and p_date between r.date_from and r.date_to) or (r.kind='weekly' and r.day_of_week=dow)) order by case r.kind when 'date' then 3 when 'range' then 2 else 1 end desc,r.priority desc,r.created_at desc loop
                                                 branch_id:=v_row.branch_id; tz:=coalesce(v_row.tz,v_tz,'Asia/Bishkek'); intervals:=coalesce(v_row.intervals,'[]'::jsonb); breaks:=coalesce(v_row.breaks,'[]'::jsonb); v_sched_found:=true; return next; return;
                                                  end loop;
                                                   if not v_sched_found then
                                                      select st.branch_id into v_branch from public.staff st where st.id=p_staff_id;
                                                         if v_branch is null then return; end if;
                                                            select wh.intervals,wh.breaks into v_intervals,v_breaks from public.working_hours wh where wh.staff_id=p_staff_id and wh.day_of_week=dow and wh.biz_id=v_biz limit 1;
                                                               if v_intervals is null then return; end if;
                                                                  branch_id:=v_branch; tz:=coalesce(v_tz,'Asia/Bishkek'); intervals:=v_intervals; breaks:=coalesce(v_breaks,'[]'::jsonb); return next; return;
                                                                   end if;
                                                                    return;
                                                                    end
                                                                    $$;


ALTER FUNCTION "public"."resolve_staff_day_legacy"("p_staff_id" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reviews_set_client_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (TG_OP = 'INSERT') then
    new.client_id := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."reviews_set_client_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_branch_admin"("p_branch_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  delete from public.branch_admins
  where branch_id = p_branch_id and user_id = p_user_id;
$$;


ALTER FUNCTION "public"."revoke_branch_admin"("p_branch_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_role"("p_user_id" "uuid", "p_role_key" "text", "p_biz_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_is_super boolean;
  v_role_id uuid;
begin
  select public.has_role('super_admin', null) into v_is_super;
  if not v_is_super then
    raise exception 'forbidden';
  end if;

  select id into v_role_id from public.roles where key = p_role_key;
  if v_role_id is null then
    return;
  end if;

  delete from public.user_roles
  where user_id = p_user_id and role_id = v_role_id and
        (p_biz_id is null and biz_id is null or biz_id = p_biz_id);
end;
$$;


ALTER FUNCTION "public"."revoke_role"("p_user_id" "uuid", "p_role_key" "text", "p_biz_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_role"("p_user" "uuid", "p_biz" "uuid", "p_role_key" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  rid uuid;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  rid := public.role_id(p_role_key);
  if rid is null then
    raise exception 'role % not found', p_role_key;
  end if;

  delete from public.user_roles
  where user_id = p_user and biz_id = p_biz and role_id = rid;
end;
$$;


ALTER FUNCTION "public"."revoke_role"("p_user" "uuid", "p_biz" "uuid", "p_role_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_role_rpc"("p_user" "uuid", "p_biz" "uuid", "p_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_role_id uuid;
  v_allowed boolean;
begin
  -- роль существует?
  select id into v_role_id from public.roles where key = p_role;
  if v_role_id is null then
    raise exception 'invalid role %', p_role using errcode = 'P0001';
  end if;

  -- право вызывать
  if p_biz is null then
    v_allowed := public.has_role('super_admin'::text, null::uuid);
  else
    v_allowed :=
      public.has_role('super_admin'::text, null::uuid) or
      public.has_role('owner'::text,   p_biz) or
      public.has_role('admin'::text,   p_biz) or
      public.has_role('manager'::text, p_biz);
  end if;

  if not v_allowed then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  delete from public.user_roles ur
  where ur.user_id = p_user
    and ur.biz_id  is not distinct from p_biz
    and ur.role_id = v_role_id;
end;
$$;


ALTER FUNCTION "public"."revoke_role_rpc"("p_user" "uuid", "p_biz" "uuid", "p_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_user_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") RETURNS "void"
    LANGUAGE "sql"
    AS $$
  delete from public.user_roles ur
  using public.roles r
  where ur.user_id = p_user_id
    and ur.biz_id  = p_biz_id
    and ur.role_id = r.id                    -- <= БЫЛО r.role_id
    and r.key = p_role_key;
$$;


ALTER FUNCTION "public"."revoke_user_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."role_id"("p_key" "text") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id from public.roles where key = p_key
$$;


ALTER FUNCTION "public"."role_id"("p_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rule_branch_is_not_home"("p_staff_id" "uuid", "p_branch_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select not exists (
    select 1
    from public.staff s
    where s.id = p_staff_id
      and s.branch_id = p_branch_id
  );
$$;


ALTER FUNCTION "public"."rule_branch_is_not_home"("p_staff_id" "uuid", "p_branch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_shift_items_atomic"("p_shift_id" "uuid", "p_items" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
    v_shift_status text;
    v_result jsonb;
    v_item jsonb;
    v_inserted_count integer := 0;
    v_deleted_count integer := 0;
begin
    -- Проверяем, что смена существует и открыта
    select status
    into v_shift_status
    from public.staff_shifts
    where id = p_shift_id
    for update;  -- Блокируем строку для обновления
    
    if v_shift_status is null then
        return jsonb_build_object(
            'ok', false,
            'error', 'Смена не найдена'
        );
    end if;
    
    if v_shift_status != 'open' then
        return jsonb_build_object(
            'ok', false,
            'error', 'Смена должна быть открыта для сохранения позиций'
        );
    end if;
    
    -- Удаляем все существующие позиции для этой смены
    delete from public.staff_shift_items
    where shift_id = p_shift_id;
    
    get diagnostics v_deleted_count = row_count;
    
    -- Вставляем новые позиции
    if p_items is not null and jsonb_array_length(p_items) > 0 then
        insert into public.staff_shift_items (
            shift_id,
            client_name,
            service_name,
            service_amount,
            consumables_amount,
            booking_id,
            note,
            created_at
        )
        select
            p_shift_id,
            (item->>'clientName')::text,
            (item->>'serviceName')::text,
            coalesce(((item->>'serviceAmount')::numeric), 0),
            coalesce(((item->>'consumablesAmount')::numeric), 0),
            case when (item->>'bookingId')::text = '' then null else (item->>'bookingId')::uuid end,
            (item->>'note')::text,
            coalesce(
                ((item->>'createdAt')::timestamptz),
                timezone('utc'::text, now())
            )
        from jsonb_array_elements(p_items) as item
        where
            -- Сохраняем только если есть данные
            coalesce(((item->>'serviceAmount')::numeric), 0) > 0
            or coalesce(((item->>'consumablesAmount')::numeric), 0) > 0
            or (item->>'bookingId')::text is not null
            or ((item->>'clientName')::text is not null and (item->>'clientName')::text != '');
        
        get diagnostics v_inserted_count = row_count;
    end if;
    
    -- Возвращаем результат
    return jsonb_build_object(
        'ok', true,
        'deleted_count', v_deleted_count,
        'inserted_count', v_inserted_count
    );
    
exception
    when others then
        return jsonb_build_object(
            'ok', false,
            'error', 'Ошибка при сохранении позиций: ' || sqlerrm
        );
end;
$$;


ALTER FUNCTION "public"."save_shift_items_atomic"("p_shift_id" "uuid", "p_items" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."save_shift_items_atomic"("p_shift_id" "uuid", "p_items" "jsonb") IS 'Атомарно сохраняет позиции смены в транзакции. Удаляет старые позиции и вставляет новые. Проверяет, что смена открыта.';



CREATE OR REPLACE FUNCTION "public"."schedule_actor_can_manage"("p_actor" "uuid", "p_biz" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    select p_actor is not null and (
        exists(select 1 from public.businesses where id=p_biz and owner_id=p_actor)
        or exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
                  where ur.user_id=p_actor and (r.key='super_admin' or (ur.biz_id=p_biz and r.key in ('owner','admin','manager'))))
    );
$$;


ALTER FUNCTION "public"."schedule_actor_can_manage"("p_actor" "uuid", "p_biz" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."schedule_bound_to_branch"("p_day" "jsonb", "p_biz" "uuid", "p_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."schedule_bound_to_branch"("p_day" "jsonb", "p_biz" "uuid", "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."schedule_contains_booking"("p_staff" "uuid", "p_branch" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."schedule_contains_booking"("p_staff" "uuid", "p_branch" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."schedule_effective_day"("p_staff" "uuid", "p_day" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare st record; v record; legacy record; regular_day boolean := false; result jsonb; business_tz text;
begin
 select s.*,coalesce(b.tz,'Asia/Bishkek') as business_tz into st from public.staff s join public.businesses b on b.id=s.biz_id where s.id=p_staff;
  if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
   business_tz:=st.business_tz;
    result:=jsonb_build_object('date',p_day,'branch_id',st.branch_id,'tz',business_tz,'source','unconfigured','intervals','[]'::jsonb,'breaks','[]'::jsonb);
     if not st.is_active then return result; end if;
      if exists(select 1 from public.staff_time_off t where t.staff_id=p_staff and t.biz_id=st.biz_id and t.cancelled_at is null and p_day between t.date_from and t.date_to) then return result||jsonb_build_object('source','absence'); end if;
       select * into v from public.staff_schedule_versions where staff_id=p_staff and kind='day' and effective_from=p_day order by revision desc limit 1;
        regular_day:=found and coalesce(v.days->'day'->>'use_regular','false')='true';
         if found and not regular_day then return public.schedule_bound_to_branch(result||(v.days->'day')||jsonb_build_object('branch_id',v.branch_id,'source','day'),st.biz_id,p_day); end if;
          if not regular_day and exists(select 1 from public.staff_schedule_rules r where r.staff_id=p_staff and r.is_active and ((r.kind='date' and r.date_on=p_day) or (r.kind='range' and p_day between r.date_from and r.date_to))) then
             select * into legacy from public.resolve_staff_day_legacy(p_staff,p_day);
                if found then return result||to_jsonb(legacy)||jsonb_build_object('source','legacy'); end if;
                 end if;
                  select * into v from public.staff_schedule_versions where staff_id=p_staff and kind='week' and effective_from<=p_day order by effective_from desc,revision desc limit 1;
                   if found then return public.schedule_bound_to_branch(result||(v.days->extract(isodow from p_day)::int::text)||jsonb_build_object('branch_id',v.branch_id,'source','week'),st.biz_id,p_day); end if;
                    select * into legacy from public.resolve_staff_day_legacy(p_staff,p_day);
                     if found then
                        if not exists(select 1 from public.staff_schedule_rules r where r.staff_id=p_staff and r.is_active and r.kind='weekly' and r.day_of_week=extract(dow from p_day)::int)
                             and exists(select 1 from public.staff_home_branch_changes c where c.staff_id=p_staff) then
                                  legacy.branch_id:=coalesce((select c.to_branch_id from public.staff_home_branch_changes c where c.staff_id=p_staff and c.effective_on<=p_day order by c.effective_on desc,c.id desc limit 1),(select c.from_branch_id from public.staff_home_branch_changes c where c.staff_id=p_staff order by c.effective_on,c.id limit 1));
                                     end if;
                                        return result||to_jsonb(legacy)||jsonb_build_object('source','legacy');
                                         end if;
                                          return result;
                                          end;
                                          $$;


ALTER FUNCTION "public"."schedule_effective_day"("p_staff" "uuid", "p_day" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."schedule_validate_day"("p_day" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."schedule_validate_day"("p_day" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_my_notification_email_preferences"("target_enabled" boolean, "target_emails" "text"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    normalized_emails text[] := coalesce(
        (
            select array_agg(distinct lower(btrim(value)))
            from unnest(coalesce(target_emails, array[]::text[])) value
            where btrim(value) <> ''
        ),
        array[]::text[]
    );
begin
    if auth.uid() is null then
        raise exception 'Authentication required';
    end if;
    if target_enabled and cardinality(normalized_emails) = 0 then
        raise exception 'Select at least one notification email';
    end if;
    if exists (
        select 1
        from unnest(normalized_emails) selected_email
        where not exists (
            select 1
            from public.user_notification_emails email
            where email.user_id = auth.uid()
              and email.email = selected_email
              and email.verified
        )
    ) then
        raise exception 'Unknown or unverified notification email';
    end if;

    update public.user_notification_emails
    set enabled = email = any(normalized_emails),
        updated_at = now()
    where user_id = auth.uid();

    update public.profiles
    set notify_email = target_enabled
    where id = auth.uid();
end;
$$;


ALTER FUNCTION "public"."set_my_notification_email_preferences"("target_enabled" boolean, "target_emails" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_timestamp_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;


ALTER FUNCTION "public"."set_timestamp_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_auth_user_notification_email"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    if tg_op = 'UPDATE' and old.email is distinct from new.email then
        perform public.remove_user_notification_email_source(new.id, 'account');
    end if;

    if new.email is not null and new.email_confirmed_at is not null then
        perform public.sync_user_notification_email(new.id, new.email, 'account', new.id::text);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "public"."sync_auth_user_notification_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_notification_email"("target_user_id" "uuid", "target_email" "text", "target_source" "text", "target_provider_subject" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
    normalized_email text := lower(btrim(target_email));
    notification_email_id uuid;
    should_enable boolean;
begin
    if target_source not in ('account', 'google', 'yandex') then
        raise exception 'Unsupported notification email source';
    end if;
    if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
        raise exception 'Invalid notification email';
    end if;

    select not exists (
        select 1
        from public.user_notification_emails
        where user_id = target_user_id
    ) into should_enable;

    insert into public.user_notification_emails(user_id, email, verified, enabled)
    values (target_user_id, normalized_email, true, should_enable)
    on conflict (user_id, email) do update
    set verified = true,
        updated_at = now()
    returning id into notification_email_id;

    insert into public.user_notification_email_sources(
        email_id,
        source,
        provider_subject
    )
    values (
        notification_email_id,
        target_source,
        target_provider_subject
    )
    on conflict (email_id, source) do update
    set provider_subject = excluded.provider_subject;
end;
$_$;


ALTER FUNCTION "public"."sync_user_notification_email"("target_user_id" "uuid", "target_email" "text", "target_source" "text", "target_provider_subject" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_staff_home"("p_staff" "uuid", "p_biz" "uuid", "p_actor" "uuid", "p_expected_branch" "uuid", "p_target" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare st record; today date; tz text;
begin
    if not public.schedule_actor_can_manage(p_actor,p_biz) then raise exception 'SCHEDULE_FORBIDDEN'; end if;
    -- Same branch -> staff lock order as replacement of branch opening hours.
    perform 1 from public.branches where id=p_target and biz_id=p_biz and is_active for update;
    if not found then raise exception 'SCHEDULE_INVALID_BRANCH'; end if;
    select * into st from public.staff where id=p_staff and biz_id=p_biz for update;
    if not found or not st.is_active then raise exception 'SCHEDULE_NOT_FOUND'; end if;
    if st.branch_id is distinct from p_expected_branch then raise exception 'SCHEDULE_STALE'; end if;
    if st.branch_id=p_target then raise exception 'SCHEDULE_SAME_BRANCH'; end if;
    select coalesce(b.tz,'Asia/Bishkek') into tz from public.businesses b where b.id=p_biz;
    today := (now() at time zone tz)::date;
    -- Never delete a separately planned future assignment to make today's transfer fit.
    if exists(select 1 from public.staff_branch_assignments where staff_id=p_staff and valid_from>today)
        then raise exception 'SCHEDULE_FUTURE_ASSIGNMENT'; end if;
    update public.staff_branch_assignments set valid_to=today-1
        where staff_id=p_staff and valid_from<today and (valid_to is null or valid_to>=today);
    delete from public.staff_branch_assignments where staff_id=p_staff and valid_from=today;
    insert into public.staff_branch_assignments(biz_id,staff_id,branch_id,valid_from)
        values(p_biz,p_staff,p_target,today);
    insert into public.staff_home_branch_changes(staff_id,biz_id,from_branch_id,to_branch_id,effective_on,created_by)
        values(p_staff,p_biz,st.branch_id,p_target,today,p_actor);
    update public.staff set branch_id=p_target where id=p_staff;
    -- Published plans keep their branch; legacy inherited hours may change location.
    -- A conflicting future reservation aborts membership, assignments and audit together.
    if exists(select 1 from public.bookings b where b.staff_id=p_staff and b.end_at>now()
        and (b.status::text in ('confirmed','paid') or (b.status::text='hold' and b.expires_at>now()))
        and not public.schedule_contains_booking(p_staff,b.branch_id,b.start_at,b.end_at))
        then raise exception 'SCHEDULE_BOOKING_CONFLICT'; end if;
    return jsonb_build_object('note','HOME_BRANCH_CHANGED_SCHEDULE_PRESERVED');
end;
$$;


ALTER FUNCTION "public"."transfer_staff_home"("p_staff" "uuid", "p_biz" "uuid", "p_actor" "uuid", "p_expected_branch" "uuid", "p_target" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_telegram_profile_link"("p_hash" "text", "p_action" "text", "p_owner" "uuid" DEFAULT NULL::"uuid", "p_telegram" bigint DEFAULT NULL::bigint, "p_username" "text" DEFAULT NULL::"text", "p_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    a public.telegram_profile_link_attempts%rowtype;
    current_telegram bigint;
begin
    select * into a from public.telegram_profile_link_attempts where token_hash = p_hash for update;
    if not found then return jsonb_build_object('error','not_found'); end if;
    if p_action in ('finish','cancel_owner') then
        if p_owner is null or a.owner_id <> p_owner then return jsonb_build_object('error','not_found'); end if;
    elsif p_action not in ('claim','approve','cancel_bot') or p_telegram is null or p_telegram <= 0 then
        return jsonb_build_object('error','invalid_action');
    end if;
    if a.status = 'consumed' and p_action = 'finish' and a.telegram_id = p_telegram then
        return jsonb_build_object('status','consumed');
    end if;
    if a.expires_at <= now() then
        update public.telegram_profile_link_attempts set status = 'expired' where token_hash = p_hash and status in ('pending','approved');
        return jsonb_build_object('error','expired');
    end if;
    if a.status not in ('pending','approved') then return jsonb_build_object('error','closed'); end if;
    if p_action = 'cancel_owner' then
        update public.telegram_profile_link_attempts set status = 'cancelled' where token_hash = p_hash;
        return jsonb_build_object('status','cancelled');
    end if;
    if a.telegram_id is not null and a.telegram_id <> p_telegram then
        return jsonb_build_object('error','different_account');
    end if;
    if p_action = 'claim' then
        if a.status <> 'pending' then return jsonb_build_object('error','closed'); end if;
        update public.telegram_profile_link_attempts set telegram_id = p_telegram,
            telegram_username = left(p_username, 64), telegram_name = left(p_name, 128) where token_hash = p_hash;
        return jsonb_build_object('status','pending');
    end if;
    if a.telegram_id is null then return jsonb_build_object('error','not_claimed'); end if;
    if p_action in ('approve','cancel_bot') then
        update public.telegram_profile_link_attempts set status = case when p_action = 'approve' then 'approved' else 'cancelled' end where token_hash = p_hash;
        return jsonb_build_object('status',case when p_action = 'approve' then 'approved' else 'cancelled' end);
    end if;
    if p_action <> 'finish' or a.status <> 'approved' or p_telegram is null then
        return jsonb_build_object('error','not_approved');
    end if;
    select telegram_id into current_telegram from public.profiles where id = a.owner_id for update;
    if not found then return jsonb_build_object('error','profile_missing'); end if;
    if current_telegram is not null and current_telegram <> a.telegram_id then
        return jsonb_build_object('error','already_connected');
    end if;
    if exists (select 1 from public.profiles where telegram_id = a.telegram_id and id <> a.owner_id) then
        return jsonb_build_object('error','already_linked');
    end if;
    begin
        update public.profiles set telegram_id = a.telegram_id, telegram_username = a.telegram_username,
            telegram_photo_url = null, telegram_verified = true where id = a.owner_id;
        update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) ||
            jsonb_build_object('telegram_id',a.telegram_id,'telegram_username',a.telegram_username)
            where id = a.owner_id;
        update public.telegram_profile_link_attempts set status = 'consumed' where token_hash = p_hash;
    exception when unique_violation then
        return jsonb_build_object('error','already_linked');
    end;
    return jsonb_build_object('status','consumed');
end;
$$;


ALTER FUNCTION "public"."transition_telegram_profile_link"("p_hash" "text", "p_action" "text", "p_owner" "uuid", "p_telegram" bigint, "p_username" "text", "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transition_telegram_web_login"("p_hash" "text", "p_action" "text", "p_browser" "text" DEFAULT NULL::"text", "p_telegram" bigint DEFAULT NULL::bigint, "p_name" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
 a public.telegram_web_login_attempts%rowtype;
 uid uuid;
begin
 if p_action not in ('claim','approve','cancel_bot','cancel','finish') then
 return jsonb_build_object('error','invalid_action'); end if;
 select * into a from public.telegram_web_login_attempts where token_hash = p_hash for update;
 if not found then return jsonb_build_object('error','not_found'); end if;
 if p_action in ('cancel','finish') and (p_browser is null or p_browser <> a.browser_hash) then
 return jsonb_build_object('error','not_found'); end if;
 if a.status in ('consumed','cancelled','expired') then return jsonb_build_object('error','closed'); end if;
 if a.expires_at <= now() then
 update public.telegram_web_login_attempts set status = 'expired' where token_hash = p_hash;
 return jsonb_build_object('error','expired'); end if;
 if p_action = 'cancel' then
 update public.telegram_web_login_attempts set status = 'cancelled' where token_hash = p_hash;
 return jsonb_build_object('status','cancelled'); end if;
 if p_telegram is null or p_telegram <= 0 then return jsonb_build_object('error','invalid_account'); end if;
 if a.telegram_id is not null and a.telegram_id <> p_telegram then
 return jsonb_build_object('error','different_account'); end if;
 if p_action = 'claim' then
 update public.telegram_web_login_attempts set telegram_id = p_telegram, telegram_name = left(p_name, 160) where token_hash = p_hash;
 return jsonb_build_object('status',a.status); end if;
 if a.telegram_id is null then return jsonb_build_object('error','not_claimed'); end if;
 if p_action = 'cancel_bot' then
 update public.telegram_web_login_attempts set status = 'cancelled' where token_hash = p_hash;
 return jsonb_build_object('status','cancelled'); end if;
 if p_action = 'approve' then
 update public.telegram_web_login_attempts set status = 'approved' where token_hash = p_hash;
 return jsonb_build_object('status','approved'); end if;
 if a.status <> 'approved' then return jsonb_build_object('error','not_approved'); end if;
 select id into uid from public.profiles where telegram_id = p_telegram and telegram_verified = true for share;
 if uid is null then return jsonb_build_object('error','not_linked'); end if;
 update public.telegram_web_login_attempts set status = 'consumed' where token_hash = p_hash;
 return jsonb_build_object('status','consumed','user_id',uid);
end $$;


ALTER FUNCTION "public"."transition_telegram_web_login"("p_hash" "text", "p_action" "text", "p_browser" "text", "p_telegram" bigint, "p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unlink_auth_identity"("target_user_id" "uuid", "target_provider" "text") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
    deleted_count integer;
begin
    if target_provider not in ('google') then
        raise exception 'Unsupported auth identity provider';
    end if;

    delete from auth.identities
    where user_id = target_user_id
      and provider = target_provider;

    get diagnostics deleted_count = row_count;
    return deleted_count;
end;
$$;


ALTER FUNCTION "public"."unlink_auth_identity"("target_user_id" "uuid", "target_provider" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_all_aggregated_ratings"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
    r_staff record;
    r_branch record;
    r_biz record;
    v_staff_rating numeric;
    v_branch_rating numeric;
    v_biz_rating numeric;
    v_default_rating numeric := 50.0;
begin
    raise notice 'Updating aggregated ratings for all active staff, branches, and approved businesses...';

    for r_staff in select id from public.staff where is_active = true loop
        begin
            v_staff_rating := public.calculate_staff_rating(r_staff.id);
            if v_staff_rating is null then
                v_staff_rating := v_default_rating;
            end if;
            update public.staff set rating_score = v_staff_rating where id = r_staff.id;
        exception when others then
            raise notice 'Error calculating staff rating for staff_id=%: %', r_staff.id, SQLERRM;
            update public.staff set rating_score = v_default_rating where id = r_staff.id and rating_score is null;
        end;
    end loop;

    for r_branch in select id from public.branches where is_active = true loop
        begin
            v_branch_rating := public.calculate_branch_rating(r_branch.id);
            if v_branch_rating is null then
                select coalesce(avg(rating_score), v_default_rating) into v_branch_rating
                from public.staff
                where branch_id = r_branch.id and is_active = true and rating_score is not null;
            end if;
            update public.branches set rating_score = v_branch_rating where id = r_branch.id;
        exception when others then
            raise notice 'Error calculating branch rating for branch_id=%: %', r_branch.id, SQLERRM;
            update public.branches set rating_score = v_default_rating where id = r_branch.id and rating_score is null;
        end;
    end loop;

    for r_biz in select id from public.businesses where is_approved = true loop
        begin
            v_biz_rating := public.calculate_biz_rating(r_biz.id);
            if v_biz_rating is null then
                select coalesce(avg(rating_score), v_default_rating) into v_biz_rating
                from public.branches
                where biz_id = r_biz.id and is_active = true and rating_score is not null;
            end if;
            update public.businesses set rating_score = v_biz_rating where id = r_biz.id;
        exception when others then
            raise notice 'Error calculating biz rating for biz_id=%: %', r_biz.id, SQLERRM;
            update public.businesses set rating_score = v_default_rating where id = r_biz.id and rating_score is null;
        end;
    end loop;

    raise notice 'Aggregated ratings update completed';
end;
$$;


ALTER FUNCTION "public"."update_all_aggregated_ratings"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_all_aggregated_ratings"() IS 'Обновляет агрегированные рейтинги (rating_score) для всех активных staff, branches и одобренных businesses по уже рассчитанным дневным метрикам. Вызывать после батчевого пересчёта метрик по диапазонам дат.';



CREATE OR REPLACE FUNCTION "public"."update_booking_status_no_check"("p_booking_id" "uuid", "p_new_status" "public"."booking_status") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Просто обновляем статус без проверок
    UPDATE bookings
    SET status = p_new_status
    WHERE id = p_booking_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_booking_status_no_check"("p_booking_id" "uuid", "p_new_status" "public"."booking_status") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_booking_status_no_check"("p_booking_id" "uuid", "p_new_status" "public"."booking_status") IS 'Обновляет статус брони без проверки назначения сотрудника. Используется для отметки посещения прошедших броней.';



CREATE OR REPLACE FUNCTION "public"."update_booking_status_with_promotion"("p_booking_id" "uuid", "p_new_status" "public"."booking_status") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."update_booking_status_with_promotion"("p_booking_id" "uuid", "p_new_status" "public"."booking_status") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_booking_status_with_promotion"("p_booking_id" "uuid", "p_new_status" "public"."booking_status") IS 'Обновляет статус бронирования. При paid: сначала пакет визитов, затем промоакция.';



CREATE OR REPLACE FUNCTION "public"."update_shift_aggregates"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_shift_date" "date", "p_total_amount" numeric, "p_master_share" numeric, "p_salon_share" numeric, "p_late_minutes" integer, "p_guaranteed_amount" numeric DEFAULT 0, "p_topup_amount" numeric DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
    v_day_value text;
    v_month_value text;
    v_year_value text;
    v_final_master numeric;
    v_final_salon numeric;
begin
    -- Вычисляем значения периодов
    v_day_value := to_char(p_shift_date, 'YYYY-MM-DD');
    v_month_value := to_char(p_shift_date, 'YYYY-MM');
    v_year_value := to_char(p_shift_date, 'YYYY');
    
    -- Вычисляем финальные суммы (как в useShiftStats)
    -- totalMaster = max(guaranteed_amount, master_share)
    v_final_master := greatest(p_guaranteed_amount, p_master_share);
    -- totalSalon = salon_share - topup_amount
    v_final_salon := p_salon_share - p_topup_amount;
    
    -- Обновляем дневной агрегат
    insert into public.staff_shift_aggregates (
        staff_id,
        biz_id,
        period_type,
        period_value,
        shifts_count,
        total_amount,
        total_master,
        total_salon,
        total_late_minutes,
        updated_at
    )
    values (
        p_staff_id,
        p_biz_id,
        'day',
        v_day_value,
        1,
        p_total_amount,
        v_final_master,
        v_final_salon,
        p_late_minutes,
        timezone('utc'::text, now())
    )
    on conflict (staff_id, period_type, period_value)
    do update set
        shifts_count = staff_shift_aggregates.shifts_count + 1,
        total_amount = staff_shift_aggregates.total_amount + p_total_amount,
        total_master = staff_shift_aggregates.total_master + v_final_master,
        total_salon = staff_shift_aggregates.total_salon + v_final_salon,
        total_late_minutes = staff_shift_aggregates.total_late_minutes + p_late_minutes,
        updated_at = timezone('utc'::text, now());
    
    -- Обновляем месячный агрегат
    insert into public.staff_shift_aggregates (
        staff_id,
        biz_id,
        period_type,
        period_value,
        shifts_count,
        total_amount,
        total_master,
        total_salon,
        total_late_minutes,
        updated_at
    )
    values (
        p_staff_id,
        p_biz_id,
        'month',
        v_month_value,
        1,
        p_total_amount,
        v_final_master,
        v_final_salon,
        p_late_minutes,
        timezone('utc'::text, now())
    )
    on conflict (staff_id, period_type, period_value)
    do update set
        shifts_count = staff_shift_aggregates.shifts_count + 1,
        total_amount = staff_shift_aggregates.total_amount + p_total_amount,
        total_master = staff_shift_aggregates.total_master + v_final_master,
        total_salon = staff_shift_aggregates.total_salon + v_final_salon,
        total_late_minutes = staff_shift_aggregates.total_late_minutes + p_late_minutes,
        updated_at = timezone('utc'::text, now());
    
    -- Обновляем годовой агрегат
    insert into public.staff_shift_aggregates (
        staff_id,
        biz_id,
        period_type,
        period_value,
        shifts_count,
        total_amount,
        total_master,
        total_salon,
        total_late_minutes,
        updated_at
    )
    values (
        p_staff_id,
        p_biz_id,
        'year',
        v_year_value,
        1,
        p_total_amount,
        v_final_master,
        v_final_salon,
        p_late_minutes,
        timezone('utc'::text, now())
    )
    on conflict (staff_id, period_type, period_value)
    do update set
        shifts_count = staff_shift_aggregates.shifts_count + 1,
        total_amount = staff_shift_aggregates.total_amount + p_total_amount,
        total_master = staff_shift_aggregates.total_master + v_final_master,
        total_salon = staff_shift_aggregates.total_salon + v_final_salon,
        total_late_minutes = staff_shift_aggregates.total_late_minutes + p_late_minutes,
        updated_at = timezone('utc'::text, now());
end;
$$;


ALTER FUNCTION "public"."update_shift_aggregates"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_shift_date" "date", "p_total_amount" numeric, "p_master_share" numeric, "p_salon_share" numeric, "p_late_minutes" integer, "p_guaranteed_amount" numeric, "p_topup_amount" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_shift_aggregates"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_shift_date" "date", "p_total_amount" numeric, "p_master_share" numeric, "p_salon_share" numeric, "p_late_minutes" integer, "p_guaranteed_amount" numeric, "p_topup_amount" numeric) IS 'Обновляет агрегированные статистики при закрытии смены. Обновляет дневные, месячные и годовые агрегаты.';



CREATE OR REPLACE FUNCTION "public"."user_current_business_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."user_current_business_set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_deletion_requests" (
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scheduled_for" timestamp with time zone NOT NULL,
    "cancelled_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "blocker_snapshot" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "preference_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "account_deletion_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'cancelled'::"text", 'completed'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."account_deletion_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "event_type" "text" NOT NULL,
    "biz_id" "uuid",
    "branch_id" "uuid",
    "booking_id" "uuid",
    "client_id" "uuid",
    "source" "text" NOT NULL,
    "session_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."analytics_events" IS 'Сырые события воронки и бизнес‑аналитики (frontend + backend).';



COMMENT ON COLUMN "public"."analytics_events"."created_at" IS 'Время фиксации события (UTC).';



COMMENT ON COLUMN "public"."analytics_events"."event_type" IS 'Тип события: home_view, business_page_view, booking_flow_start, booking_flow_step, booking_created, booking_confirmed_or_paid и т.п.';



COMMENT ON COLUMN "public"."analytics_events"."biz_id" IS 'Бизнес, к которому относится событие (если применимо).';



COMMENT ON COLUMN "public"."analytics_events"."branch_id" IS 'Филиал, к которому относится событие (если применимо).';



COMMENT ON COLUMN "public"."analytics_events"."booking_id" IS 'Бронирование, к которому относится событие (если применимо).';



COMMENT ON COLUMN "public"."analytics_events"."client_id" IS 'Клиент (если известен / авторизован).';



COMMENT ON COLUMN "public"."analytics_events"."source" IS 'Источник события: web, mobile, staff_dashboard, system и т.п.';



COMMENT ON COLUMN "public"."analytics_events"."session_id" IS 'Сессия пользователя (для построения воронки).';



COMMENT ON COLUMN "public"."analytics_events"."metadata" IS 'Дополнительные данные события в формате JSON (step, locale, referrer, A/B‑флаги и т.д.).';



CREATE TABLE IF NOT EXISTS "public"."api_request_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "endpoint" "text" NOT NULL,
    "method" "text" DEFAULT 'GET'::"text" NOT NULL,
    "status_code" integer NOT NULL,
    "duration_ms" integer NOT NULL,
    "request_size_bytes" integer,
    "response_size_bytes" integer,
    "user_id" "uuid",
    "staff_id" "uuid",
    "biz_id" "uuid",
    "error_message" "text",
    "error_type" "text",
    "metadata" "jsonb",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."api_request_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."api_request_metrics" IS 'Метрики API запросов для мониторинга производительности и анализа ошибок';



COMMENT ON COLUMN "public"."api_request_metrics"."endpoint" IS 'Путь эндпоинта (например, /api/staff/finance)';



COMMENT ON COLUMN "public"."api_request_metrics"."method" IS 'HTTP метод запроса';



COMMENT ON COLUMN "public"."api_request_metrics"."status_code" IS 'HTTP статус код ответа';



COMMENT ON COLUMN "public"."api_request_metrics"."duration_ms" IS 'Время выполнения запроса в миллисекундах';



COMMENT ON COLUMN "public"."api_request_metrics"."error_type" IS 'Тип ошибки: validation, database, auth, server, network';



COMMENT ON COLUMN "public"."api_request_metrics"."metadata" IS 'Дополнительные данные запроса в формате JSON';



CREATE TABLE IF NOT EXISTS "public"."application_moderation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_kind" "text" NOT NULL,
    "application_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "actor_user_id" "uuid",
    "target_user_id" "uuid",
    "biz_id" "uuid",
    "reason" "text",
    "blocked_until" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "application_moderation_actions_action_check" CHECK (("action" = ANY (ARRAY['approved'::"text", 'rejected'::"text", 'rejected_and_blocked'::"text", 'cancelled'::"text", 'unblocked'::"text"]))),
    CONSTRAINT "application_moderation_actions_application_kind_check" CHECK (("application_kind" = ANY (ARRAY['business_registration'::"text", 'owner'::"text", 'staff'::"text"])))
);


ALTER TABLE "public"."application_moderation_actions" OWNER TO "postgres";


COMMENT ON TABLE "public"."application_moderation_actions" IS 'Append-only audit trail for application moderation decisions.';



CREATE TABLE IF NOT EXISTS "public"."application_submission_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "application_kind" "text" NOT NULL,
    "subject_user_id" "uuid",
    "subject_phone" "text",
    "biz_id" "uuid",
    "blocked_until" timestamp with time zone NOT NULL,
    "reason" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "released_at" timestamp with time zone,
    "released_by" "uuid",
    CONSTRAINT "application_submission_blocks_application_kind_check" CHECK (("application_kind" = ANY (ARRAY['business_registration'::"text", 'owner'::"text", 'staff'::"text"]))),
    CONSTRAINT "application_submission_blocks_check" CHECK ((("subject_user_id" IS NOT NULL) OR ("subject_phone" IS NOT NULL)))
);


ALTER TABLE "public"."application_submission_blocks" OWNER TO "postgres";


COMMENT ON TABLE "public"."application_submission_blocks" IS 'Time-bound, moderator-created submission blocks enforced by database application policy triggers.';



CREATE TABLE IF NOT EXISTS "public"."user_suspensions" (
    "user_id" "uuid" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."user_suspensions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."auth_users_view" AS
 SELECT "id",
    "email",
    "phone",
    NULLIF(("raw_user_meta_data" ->> 'full_name'::"text"), ''::"text") AS "full_name",
    "created_at",
    (EXISTS ( SELECT 1
           FROM "public"."user_suspensions" "s"
          WHERE ("s"."user_id" = "u"."id"))) AS "is_suspended"
   FROM "auth"."users" "u";


ALTER VIEW "public"."auth_users_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."biz_day_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "metric_date" "date" NOT NULL,
    "avg_branch_score" numeric(5,2),
    "total_clients_count" integer DEFAULT 0 NOT NULL,
    "total_revenue" numeric(12,2) DEFAULT 0 NOT NULL,
    "avg_rating" numeric(3,2),
    "total_reviews_count" integer DEFAULT 0 NOT NULL,
    "day_score" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."biz_day_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."biz_day_metrics" IS 'Дневные метрики бизнесов для расчета рейтинга';



CREATE TABLE IF NOT EXISTS "public"."booking_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "duration_min" integer NOT NULL,
    "order_index" integer DEFAULT 0 NOT NULL,
    "price_from" numeric(10,2),
    "price_to" numeric(10,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."booking_services" OWNER TO "postgres";


COMMENT ON TABLE "public"."booking_services" IS 'Состав услуг по каждому бронированию (комплексы услуг, несколько услуг за один визит).';



COMMENT ON COLUMN "public"."booking_services"."booking_id" IS 'ID бронирования (public.bookings), к которому относится услуга.';



COMMENT ON COLUMN "public"."booking_services"."service_id" IS 'ID услуги (public.services), зафиксированной в составе брони.';



COMMENT ON COLUMN "public"."booking_services"."duration_min" IS 'Длительность этой услуги на момент создания бронирования (в минутах).';



COMMENT ON COLUMN "public"."booking_services"."order_index" IS 'Порядок выполнения услуги в рамках одного визита (0, 1, 2, ...).';



COMMENT ON COLUMN "public"."booking_services"."price_from" IS 'Цена \"от\" для услуги на момент бронирования (для отображения истории).';



COMMENT ON COLUMN "public"."booking_services"."price_to" IS 'Цена \"до\" для услуги на момент бронирования (для отображения истории).';



CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "service_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "status" "public"."booking_status" DEFAULT 'hold'::"public"."booking_status" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "source" "text" DEFAULT 'web'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "time_range" "tstzrange" GENERATED ALWAYS AS ("tstzrange"("start_at", "end_at", '[)'::"text")) STORED,
    "client_phone" "text",
    "client_name" "text",
    "client_email" "text",
    "promotion_applied" "jsonb",
    "subscription_applied" "jsonb"
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."bookings"."client_email" IS 'Email клиента для гостевых броней (если указан)';



COMMENT ON COLUMN "public"."bookings"."promotion_applied" IS 'Информация о примененной акции (если была применена): {"promotion_id": uuid, "discount_percent": number, "final_amount": number}';



COMMENT ON COLUMN "public"."bookings"."subscription_applied" IS 'Информация о применённом пакете визитов: plan_id, plan_name, remaining_after, final_amount и т.д.';



CREATE TABLE IF NOT EXISTS "public"."branch_admins" (
    "branch_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."branch_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branch_day_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "metric_date" "date" NOT NULL,
    "avg_staff_score" numeric(5,2),
    "total_clients_count" integer DEFAULT 0 NOT NULL,
    "total_revenue" numeric(12,2) DEFAULT 0 NOT NULL,
    "avg_rating" numeric(3,2),
    "total_reviews_count" integer DEFAULT 0 NOT NULL,
    "day_score" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."branch_day_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."branch_day_metrics" IS 'Дневные метрики филиалов для расчета рейтинга';



CREATE TABLE IF NOT EXISTS "public"."branch_promotions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "promotion_type" "public"."promotion_type" NOT NULL,
    "params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "title_ru" "text" NOT NULL,
    "title_ky" "text",
    "title_en" "text",
    "description_ru" "text",
    "description_ky" "text",
    "description_en" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "valid_from" "date",
    "valid_to" "date",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."branch_promotions" OWNER TO "postgres";


COMMENT ON TABLE "public"."branch_promotions" IS 'Акции филиалов';



COMMENT ON COLUMN "public"."branch_promotions"."promotion_type" IS 'Тип акции';



COMMENT ON COLUMN "public"."branch_promotions"."params" IS 'Параметры акции в формате JSON';



COMMENT ON COLUMN "public"."branch_promotions"."title_ru" IS 'Название акции (русский)';



COMMENT ON COLUMN "public"."branch_promotions"."title_ky" IS 'Название акции (кыргызский)';



COMMENT ON COLUMN "public"."branch_promotions"."title_en" IS 'Название акции (английский)';



COMMENT ON COLUMN "public"."branch_promotions"."is_active" IS 'Активна ли акция';



COMMENT ON COLUMN "public"."branch_promotions"."valid_from" IS 'Дата начала действия акции (null = без ограничений)';



COMMENT ON COLUMN "public"."branch_promotions"."valid_to" IS 'Дата окончания действия акции (null = без ограничений)';



CREATE TABLE IF NOT EXISTS "public"."branch_working_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "intervals" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "breaks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "branch_working_hours_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."branch_working_hours" OWNER TO "postgres";


COMMENT ON TABLE "public"."branch_working_hours" IS 'Расписание работы филиалов по дням недели';



COMMENT ON COLUMN "public"."branch_working_hours"."day_of_week" IS 'День недели: 0 = воскресенье, 1 = понедельник, ..., 6 = суббота';



COMMENT ON COLUMN "public"."branch_working_hours"."intervals" IS 'Массив интервалов работы: [{start: "09:00", end: "18:00"}, ...]';



COMMENT ON COLUMN "public"."branch_working_hours"."breaks" IS 'Массив перерывов: [{start: "13:00", end: "14:00"}, ...]';



CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "coords" "public"."geography"(Point,4326),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "lat" double precision GENERATED ALWAYS AS ("public"."st_y"(("coords")::"public"."geometry")) STORED,
    "lon" double precision GENERATED ALWAYS AS ("public"."st_x"(("coords")::"public"."geometry")) STORED,
    "rating_score" numeric(5,2),
    "rating_updated_at" timestamp with time zone,
    "last_rating_recalculated_at" timestamp with time zone,
    "directory_links" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "contact_phone" "text",
    "contact_whatsapp" "text",
    "contact_email" "text",
    "website_url" "text",
    "inherit_business_contacts" boolean DEFAULT true NOT NULL,
    CONSTRAINT "branches_contact_email_length" CHECK ((("contact_email" IS NULL) OR ("char_length"("contact_email") <= 254))),
    CONSTRAINT "branches_contact_phone_format" CHECK ((("contact_phone" IS NULL) OR ("contact_phone" ~ '^\+[1-9][0-9]{7,14}$'::"text"))),
    CONSTRAINT "branches_contact_whatsapp_format" CHECK ((("contact_whatsapp" IS NULL) OR ("contact_whatsapp" ~ '^\+[1-9][0-9]{7,14}$'::"text"))),
    CONSTRAINT "branches_coords_is_point_wgs84" CHECK ((("coords" IS NULL) OR (("public"."st_geometrytype"(("coords")::"public"."geometry") = 'ST_Point'::"text") AND ("public"."st_srid"(("coords")::"public"."geometry") = 4326)))),
    CONSTRAINT "branches_directory_links_object" CHECK (("jsonb_typeof"("directory_links") = 'object'::"text")),
    CONSTRAINT "branches_website_url_format" CHECK ((("website_url" IS NULL) OR ("website_url" ~ '^https://'::"text")))
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


COMMENT ON COLUMN "public"."branches"."lat" IS 'Широта WGS84, синхронизируется из coords (EWKT)';



COMMENT ON COLUMN "public"."branches"."lon" IS 'Долгота WGS84, синхронизируется из coords (EWKT)';



COMMENT ON COLUMN "public"."branches"."rating_score" IS 'Текущий рейтинг филиала (0-100), рассчитанный за последние 30 дней';



COMMENT ON COLUMN "public"."branches"."rating_updated_at" IS 'Время последнего обновления рейтинга';



COMMENT ON COLUMN "public"."branches"."last_rating_recalculated_at" IS 'Время последнего успешного вызова calculate_branch_rating для этого филиала';



COMMENT ON COLUMN "public"."branches"."directory_links" IS 'Public links for this physical branch: instagram, two_gis, google_maps, yandex_maps.';



COMMENT ON COLUMN "public"."branches"."inherit_business_contacts" IS 'When true, missing branch contact fields fall back to business contacts.';



CREATE TABLE IF NOT EXISTS "public"."business_creation_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "source" "text" NOT NULL,
    "actor_user_id" "uuid",
    "application_id" "uuid",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "business_creation_audit_log_source_check" CHECK (("source" = ANY (ARRAY['legacy'::"text", 'public_application'::"text", 'admin_manual'::"text"])))
);


ALTER TABLE "public"."business_creation_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_creation_audit_log" IS 'Server-only audit trail for business creation and its administrative context.';



CREATE TABLE IF NOT EXISTS "public"."business_daily_stats" (
    "biz_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "home_views" integer DEFAULT 0 NOT NULL,
    "business_page_views" integer DEFAULT 0 NOT NULL,
    "booking_flow_starts" integer DEFAULT 0 NOT NULL,
    "bookings_created" integer DEFAULT 0 NOT NULL,
    "bookings_confirmed_or_paid" integer DEFAULT 0 NOT NULL,
    "promo_bookings" integer DEFAULT 0 NOT NULL,
    "promo_revenue" numeric(14,2) DEFAULT 0 NOT NULL,
    "total_revenue" numeric(14,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."business_daily_stats" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_daily_stats" IS 'Дневные агрегаты по бизнесу: воронка и выручка за день для admin-analytics.';



COMMENT ON COLUMN "public"."business_daily_stats"."biz_id" IS 'Бизнес, к которому относятся агрегированные метрики.';



COMMENT ON COLUMN "public"."business_daily_stats"."date" IS 'Календарная дата (в таймзоне бизнеса), за которую посчитаны метрики.';



COMMENT ON COLUMN "public"."business_daily_stats"."home_views" IS 'Количество событий home_view (просмотры главной/списка бизнесов), отнесённых к этому бизнесу за день.';



COMMENT ON COLUMN "public"."business_daily_stats"."business_page_views" IS 'Количество событий business_page_view (просмотры страницы бизнеса) за день.';



COMMENT ON COLUMN "public"."business_daily_stats"."booking_flow_starts" IS 'Количество начатых потоков бронирования (booking_flow_start) за день.';



COMMENT ON COLUMN "public"."business_daily_stats"."bookings_created" IS 'Количество созданных бронирований (booking_created) за день.';



COMMENT ON COLUMN "public"."business_daily_stats"."bookings_confirmed_or_paid" IS 'Количество бронирований, перешедших в статус confirmed или paid, за день.';



COMMENT ON COLUMN "public"."business_daily_stats"."promo_bookings" IS 'Количество успешных бронирований за день, к которым было применено промо (has_promotion = true).';



COMMENT ON COLUMN "public"."business_daily_stats"."promo_revenue" IS 'Суммарная выручка за день по бронированиям с промо (booking_final_amount по has_promotion = true).';



COMMENT ON COLUMN "public"."business_daily_stats"."total_revenue" IS 'Суммарная выручка за день по всем успешным бронированиям (с промо и без).';



COMMENT ON COLUMN "public"."business_daily_stats"."created_at" IS 'Время первой инициализации агрегатов за дату.';



COMMENT ON COLUMN "public"."business_daily_stats"."updated_at" IS 'Время последнего пересчёта агрегатов за дату.';



CREATE TABLE IF NOT EXISTS "public"."business_hourly_load" (
    "biz_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "hour" integer NOT NULL,
    "bookings_count" integer DEFAULT 0 NOT NULL,
    "promo_bookings_count" integer DEFAULT 0 NOT NULL,
    "staff_count" integer,
    "unique_clients_count" integer,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "business_hourly_load_hour_check" CHECK ((("hour" >= 0) AND ("hour" <= 23)))
);


ALTER TABLE "public"."business_hourly_load" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_hourly_load" IS 'Часовая загрузка по бизнесам и филиалам для heatmap и аналитики расписания.';



COMMENT ON COLUMN "public"."business_hourly_load"."biz_id" IS 'Бизнес, к которому относится агрегат.';



COMMENT ON COLUMN "public"."business_hourly_load"."branch_id" IS 'Филиал, для которого рассчитана загрузка.';



COMMENT ON COLUMN "public"."business_hourly_load"."date" IS 'Календарная дата (в таймзоне бизнеса), за которую посчитаны метрики.';



COMMENT ON COLUMN "public"."business_hourly_load"."hour" IS 'Час (0–23) в таймзоне бизнеса, к которому относится агрегат.';



COMMENT ON COLUMN "public"."business_hourly_load"."bookings_count" IS 'Количество успешных бронирований (статусы confirmed/paid), начавшихся в этот час.';



COMMENT ON COLUMN "public"."business_hourly_load"."promo_bookings_count" IS 'Количество успешных бронирований с промо (has_promotion = true), начавшихся в этот час.';



COMMENT ON COLUMN "public"."business_hourly_load"."staff_count" IS 'Количество уникальных сотрудников с бронированиями в этот час (опционально заполняется при агрегации).';



COMMENT ON COLUMN "public"."business_hourly_load"."unique_clients_count" IS 'Количество уникальных клиентов в этот час (опционально заполняется при агрегации).';



CREATE TABLE IF NOT EXISTS "public"."business_registration_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "applicant_user_id" "uuid",
    "contact_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "business_name" "text" NOT NULL,
    "city" "text",
    "category" "text",
    "comment" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "source" "text" DEFAULT 'web'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "created_business_id" "uuid",
    "directory_links" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "prior_submission_count" integer DEFAULT 0 NOT NULL,
    "risk_flags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "review_note" "text",
    CONSTRAINT "business_registration_applications_directory_links_object" CHECK (("jsonb_typeof"("directory_links") = 'object'::"text")),
    CONSTRAINT "business_registration_applications_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."business_registration_applications" OWNER TO "postgres";


COMMENT ON COLUMN "public"."business_registration_applications"."created_business_id" IS 'Business created from this public registration application after super-admin approval.';



COMMENT ON COLUMN "public"."business_registration_applications"."directory_links" IS 'Links submitted for the first physical branch: instagram, two_gis, google_maps, yandex_maps.';



CREATE TABLE IF NOT EXISTS "public"."business_role_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "applicant_user_id" "uuid" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "requested_role" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "applicant_name" "text",
    "applicant_email" "text",
    "applicant_phone" "text",
    "message" "text",
    "source" "text" DEFAULT 'web'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_note" "text",
    "prior_submission_count" integer DEFAULT 0 NOT NULL,
    "risk_flags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "evidence_links" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "policy_version" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "business_role_applications_evidence_links_object" CHECK (("jsonb_typeof"("evidence_links") = 'object'::"text")),
    CONSTRAINT "business_role_applications_policy_version_check" CHECK (("policy_version" >= 0)),
    CONSTRAINT "business_role_applications_requested_role_check" CHECK (("requested_role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'staff'::"text"]))),
    CONSTRAINT "business_role_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."business_role_applications" OWNER TO "postgres";


COMMENT ON TABLE "public"."business_role_applications" IS 'Self-service requests from signed-in users to become an owner/admin/manager/staff member of an existing business.';



COMMENT ON COLUMN "public"."business_role_applications"."policy_version" IS 'Submission policy contract version. Version 1 enables structured owner-proof enforcement.';



CREATE TABLE IF NOT EXISTS "public"."businesses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "phones" "text"[] DEFAULT '{}'::"text"[],
    "address" "text",
    "coords" "public"."geography"(Point,4326),
    "categories" "text"[] DEFAULT '{barbershop}'::"text"[],
    "tz" "text" DEFAULT 'Asia/Bishkek'::"text",
    "plan" "text" DEFAULT 'pro'::"text",
    "is_approved" boolean DEFAULT true,
    "owner_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email_notify_to" "text"[] DEFAULT '{}'::"text"[],
    "rating_score" numeric(5,2),
    "rating_updated_at" timestamp with time zone,
    "city_id" "uuid",
    "last_rating_recalculated_at" timestamp with time zone,
    "branch_limit" integer DEFAULT 1 NOT NULL,
    "creation_source" "text" DEFAULT 'legacy'::"text" NOT NULL,
    "created_by_user_id" "uuid",
    "source_application_id" "uuid",
    "contact_phone" "text",
    "contact_whatsapp" "text",
    "contact_email" "text",
    "website_url" "text",
    CONSTRAINT "businesses_branch_limit_positive" CHECK (("branch_limit" >= 1)),
    CONSTRAINT "businesses_contact_email_length" CHECK ((("contact_email" IS NULL) OR ("char_length"("contact_email") <= 254))),
    CONSTRAINT "businesses_contact_phone_format" CHECK ((("contact_phone" IS NULL) OR ("contact_phone" ~ '^\+[1-9][0-9]{7,14}$'::"text"))),
    CONSTRAINT "businesses_contact_whatsapp_format" CHECK ((("contact_whatsapp" IS NULL) OR ("contact_whatsapp" ~ '^\+[1-9][0-9]{7,14}$'::"text"))),
    CONSTRAINT "businesses_creation_source_check" CHECK (("creation_source" = ANY (ARRAY['legacy'::"text", 'public_application'::"text", 'admin_manual'::"text"]))),
    CONSTRAINT "businesses_website_url_format" CHECK ((("website_url" IS NULL) OR ("website_url" ~ '^https://'::"text")))
);


ALTER TABLE "public"."businesses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."businesses"."address" IS 'DEPRECATED: адрес теперь хранится в branches';



COMMENT ON COLUMN "public"."businesses"."owner_id" IS 'Primary owner of this business. The same user may own multiple businesses.';



COMMENT ON COLUMN "public"."businesses"."rating_score" IS 'Текущий рейтинг бизнеса (0-100), рассчитанный за последние 30 дней';



COMMENT ON COLUMN "public"."businesses"."rating_updated_at" IS 'Время последнего обновления рейтинга';



COMMENT ON COLUMN "public"."businesses"."city_id" IS 'Город бизнеса (для фильтрации в списках и на карте)';



COMMENT ON COLUMN "public"."businesses"."last_rating_recalculated_at" IS 'Время последнего успешного вызова calculate_biz_rating для этого бизнеса';



COMMENT ON COLUMN "public"."businesses"."branch_limit" IS 'Maximum number of branches allowed for the business. Existing businesses were initialized to max(current branch count, 1).';



COMMENT ON COLUMN "public"."businesses"."creation_source" IS 'Origin of the business record: legacy, public application approval, or controlled admin creation.';



COMMENT ON COLUMN "public"."businesses"."created_by_user_id" IS 'User whose action created the business. This is the reviewer for public applications or the admin for manual creation.';



COMMENT ON COLUMN "public"."businesses"."source_application_id" IS 'Public business registration application that produced this business, when applicable.';



COMMENT ON COLUMN "public"."businesses"."contact_phone" IS 'Public business phone. Never sourced from a user profile or auth identity.';



COMMENT ON COLUMN "public"."businesses"."contact_whatsapp" IS 'Public business-owned WhatsApp number in E.164 format.';



COMMENT ON COLUMN "public"."businesses"."contact_email" IS 'Public customer-facing business email.';



COMMENT ON COLUMN "public"."businesses"."website_url" IS 'Public HTTPS website URL.';



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name_ru" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_promotion_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "promotion_id" "uuid" NOT NULL,
    "promotion_type" "public"."promotion_type" NOT NULL,
    "booking_id" "uuid",
    "usage_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "used_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."client_promotion_usage" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_promotion_usage" IS 'История использования акций клиентами';



COMMENT ON COLUMN "public"."client_promotion_usage"."promotion_type" IS 'Тип акции (дублируется для быстрого поиска)';



COMMENT ON COLUMN "public"."client_promotion_usage"."usage_data" IS 'Дополнительные данные использования (например, {"visit_count": 7} для free_after_n_visits)';



CREATE TABLE IF NOT EXISTS "public"."client_referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referrer_id" "uuid" NOT NULL,
    "referred_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "referrer_booking_id" "uuid",
    "referred_booking_id" "uuid",
    "referrer_bonus_used" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."client_referrals" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_referrals" IS 'Реферальные связи между клиентами';



CREATE TABLE IF NOT EXISTS "public"."client_visit_package_uses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_visit_package_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "used_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."client_visit_package_uses" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_visit_package_uses" IS 'История списаний визитов с пакетов по бронированиям';



CREATE TABLE IF NOT EXISTS "public"."client_visit_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "remaining_visits" integer NOT NULL,
    "valid_until" "date" NOT NULL,
    "purchased_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "client_visit_packages_remaining_visits_check" CHECK (("remaining_visits" >= 0))
);


ALTER TABLE "public"."client_visit_packages" OWNER TO "postgres";


COMMENT ON TABLE "public"."client_visit_packages" IS 'Проданные пакеты визитов клиентам';



COMMENT ON COLUMN "public"."client_visit_packages"."remaining_visits" IS 'Остаток визитов';



COMMENT ON COLUMN "public"."client_visit_packages"."valid_until" IS 'Дата окончания действия пакета';



CREATE TABLE IF NOT EXISTS "public"."staff_branch_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_to" "date",
    CONSTRAINT "sba_same_biz" CHECK (("biz_id" IS NOT NULL))
);


ALTER TABLE "public"."staff_branch_assignments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."current_staff_branch" AS
 SELECT DISTINCT ON ("staff_id") "staff_id",
    "branch_id"
   FROM "public"."staff_branch_assignments"
  WHERE (("valid_to" IS NULL) OR ("valid_to" >= CURRENT_DATE))
  ORDER BY "staff_id", "valid_from" DESC;


ALTER VIEW "public"."current_staff_branch" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "scope" "text" DEFAULT 'business'::"text" NOT NULL,
    CONSTRAINT "roles_scope_check" CHECK (("scope" = ANY (ARRAY['business'::"text", 'platform'::"text"])))
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "biz_id" "uuid",
    "role_id" "uuid" NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_key" "uuid" GENERATED ALWAYS AS (COALESCE("biz_id", '00000000-0000-0000-0000-000000000000'::"uuid")) STORED
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."current_user_roles" AS
 SELECT "ur"."user_id",
    "ur"."biz_id",
    "r"."key" AS "role_key"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
  WHERE ("ur"."user_id" = "auth"."uid"());


ALTER VIEW "public"."current_user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_settings_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "changed_by_user_id" "uuid",
    "changed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "field_changes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "message" "text",
    CONSTRAINT "field_changes_array" CHECK (("jsonb_typeof"("field_changes") = 'array'::"text"))
);


ALTER TABLE "public"."finance_settings_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."finance_settings_audit_log" IS 'Журнал изменений финансовых настроек сотрудника (проценты, ставка). Для владельческого UI при просмотре смен/финансов.';



COMMENT ON COLUMN "public"."finance_settings_audit_log"."field_changes" IS 'Массив объектов: { "field": "percent_master"|"percent_salon"|"hourly_rate", "old_value": number|null, "new_value": number|null }';



CREATE TABLE IF NOT EXISTS "public"."frontend_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "metric_type" "text" NOT NULL,
    "metric_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "page" "text",
    "user_agent" "text",
    "ip_address" "inet",
    CONSTRAINT "frontend_metrics_metric_type_check" CHECK (("metric_type" = ANY (ARRAY['web-vitals'::"text", 'page-load'::"text", 'render'::"text"])))
);


ALTER TABLE "public"."frontend_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."frontend_metrics" IS 'Метрики производительности фронтенда: Core Web Vitals, время загрузки страниц, метрики рендеринга';



COMMENT ON COLUMN "public"."frontend_metrics"."metric_type" IS 'Тип метрики: web-vitals, page-load, render';



COMMENT ON COLUMN "public"."frontend_metrics"."metric_data" IS 'JSON данные метрики';



CREATE TABLE IF NOT EXISTS "public"."funnel_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "source" "text" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "branch_id" "uuid",
    "service_id" "uuid",
    "staff_id" "uuid",
    "slot_start_at" timestamp with time zone,
    "booking_id" "uuid",
    "session_id" "text" NOT NULL,
    "user_agent" "text",
    "referrer" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb",
    CONSTRAINT "funnel_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['business_view'::"text", 'branch_select'::"text", 'service_select'::"text", 'staff_select'::"text", 'slot_select'::"text", 'booking_success'::"text", 'booking_abandon'::"text"]))),
    CONSTRAINT "funnel_events_referrer_check" CHECK (("char_length"("referrer") <= 500)),
    CONSTRAINT "funnel_events_session_id_check" CHECK ((("char_length"("session_id") >= 1) AND ("char_length"("session_id") <= 255))),
    CONSTRAINT "funnel_events_source_check" CHECK (("source" = ANY (ARRAY['public'::"text", 'quickdesk'::"text"]))),
    CONSTRAINT "funnel_events_user_agent_check" CHECK (("char_length"("user_agent") <= 500))
);


ALTER TABLE "public"."funnel_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."funnel_events" IS 'Anonymous granular booking funnel. Server-only; contains no profile/contact columns. Retention: cleanup_old_funnel_events.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "notify_email" boolean DEFAULT true,
    "notify_sms" boolean DEFAULT true,
    "notify_whatsapp" boolean DEFAULT true,
    "whatsapp_verified" boolean DEFAULT false,
    "telegram_id" bigint,
    "telegram_username" "text",
    "telegram_photo_url" "text",
    "telegram_verified" boolean DEFAULT false,
    "notify_telegram" boolean DEFAULT true,
    "yandex_id" "text",
    "yandex_username" "text",
    "whatsapp_phone" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."phone" IS 'Номер телефона пользователя для связи (не используется для авторизации)';



COMMENT ON COLUMN "public"."profiles"."notify_email" IS 'Получать уведомления по email (по умолчанию: включено)';



COMMENT ON COLUMN "public"."profiles"."notify_sms" IS 'Получать уведомления по SMS (по умолчанию: включено)';



COMMENT ON COLUMN "public"."profiles"."notify_whatsapp" IS 'Получать уведомления по WhatsApp (по умолчанию: включено)';



COMMENT ON COLUMN "public"."profiles"."whatsapp_verified" IS 'Подтвержден ли номер WhatsApp для отправки уведомлений';



COMMENT ON COLUMN "public"."profiles"."telegram_id" IS 'Telegram User ID';



COMMENT ON COLUMN "public"."profiles"."telegram_username" IS 'Telegram username (без @)';



COMMENT ON COLUMN "public"."profiles"."telegram_photo_url" IS 'URL аватара из Telegram';



COMMENT ON COLUMN "public"."profiles"."telegram_verified" IS 'Подтвержден ли Telegram-аккаунт пользователя';



COMMENT ON COLUMN "public"."profiles"."notify_telegram" IS 'Получать уведомления в Telegram (по умолчанию: включено)';



COMMENT ON COLUMN "public"."profiles"."yandex_id" IS 'ID пользователя в Яндекс ID';



COMMENT ON COLUMN "public"."profiles"."yandex_username" IS 'Логин пользователя в Яндекс ID';



CREATE TABLE IF NOT EXISTS "public"."rating_biz_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "category_slug" "text",
    "staff_reviews_weight" numeric(5,2) NOT NULL,
    "staff_productivity_weight" numeric(5,2) NOT NULL,
    "staff_loyalty_weight" numeric(5,2) NOT NULL,
    "staff_discipline_weight" numeric(5,2) NOT NULL,
    "window_days" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "valid_from" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."rating_biz_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."rating_biz_config" IS 'Пер-бизнесовые настройки рейтинга (оверрайд глобального rating_global_config)';



COMMENT ON COLUMN "public"."rating_biz_config"."category_slug" IS 'Опциональная категория бизнеса для более тонкой настройки формулы рейтинга';



COMMENT ON COLUMN "public"."rating_biz_config"."window_days" IS 'Период расчёта рейтинга для этого бизнеса (скользящее окно в днях)';



CREATE TABLE IF NOT EXISTS "public"."rating_global_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_reviews_weight" numeric(5,2) DEFAULT 35.0 NOT NULL,
    "staff_productivity_weight" numeric(5,2) DEFAULT 25.0 NOT NULL,
    "staff_loyalty_weight" numeric(5,2) DEFAULT 20.0 NOT NULL,
    "staff_discipline_weight" numeric(5,2) DEFAULT 20.0 NOT NULL,
    "window_days" integer DEFAULT 30 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "valid_from" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."rating_global_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."rating_global_config" IS 'Глобальные настройки расчета рейтингов (управляется суперадмином)';



COMMENT ON COLUMN "public"."rating_global_config"."staff_reviews_weight" IS 'Вес отзывов клиентов в рейтинге сотрудника (%)';



COMMENT ON COLUMN "public"."rating_global_config"."staff_productivity_weight" IS 'Вес продуктивности (количество клиентов) в рейтинге сотрудника (%)';



COMMENT ON COLUMN "public"."rating_global_config"."staff_loyalty_weight" IS 'Вес возвращаемости клиентов в рейтинге сотрудника (%)';



COMMENT ON COLUMN "public"."rating_global_config"."staff_discipline_weight" IS 'Вес дисциплины (опоздания) в рейтинге сотрудника (%)';



COMMENT ON COLUMN "public"."rating_global_config"."window_days" IS 'Период расчета рейтинга в днях (скользящее окно)';



CREATE TABLE IF NOT EXISTS "public"."rating_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "date_from" "date" NOT NULL,
    "date_to" "date" NOT NULL,
    "scope" "text" DEFAULT 'all'::"text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "processed_days" integer DEFAULT 0 NOT NULL,
    "total_days" integer DEFAULT 0 NOT NULL,
    "error_summary" "jsonb",
    "error_message" "text"
);


ALTER TABLE "public"."rating_jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."rating_jobs" IS 'Фоновые задачи по пересчёту рейтингов (используются воркерами / cron).';



COMMENT ON COLUMN "public"."rating_jobs"."created_by" IS 'Инициатор задачи пересчёта рейтингов (user_id) или null для системного cron.';



COMMENT ON COLUMN "public"."rating_jobs"."scope" IS 'Уровень пересчёта: staff / branch / biz / all.';



COMMENT ON COLUMN "public"."rating_jobs"."status" IS 'Статус задачи пересчёта рейтингов: queued, running, success, error.';



COMMENT ON COLUMN "public"."rating_jobs"."processed_days" IS 'Количество успешно обработанных дней в диапазоне.';



COMMENT ON COLUMN "public"."rating_jobs"."total_days" IS 'Общее количество дней в диапазоне (фиксируется при создании job).';



CREATE TABLE IF NOT EXISTS "public"."rating_manual_recalc_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "user_id" "uuid",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "date_from" "date",
    "date_to" "date",
    "action" "text" NOT NULL,
    "status" "text" NOT NULL,
    "error_message" "text"
);


ALTER TABLE "public"."rating_manual_recalc_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."rating_manual_recalc_log" IS 'Лог ручных перезапусков пересчёта рейтингов из админки';



CREATE TABLE IF NOT EXISTS "public"."rating_recalc_errors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "metric_date" "date" NOT NULL,
    "error_message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "rating_recalc_errors_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['staff'::"text", 'branch'::"text", 'business'::"text"])))
);


ALTER TABLE "public"."rating_recalc_errors" OWNER TO "postgres";


COMMENT ON TABLE "public"."rating_recalc_errors" IS 'Ошибки пересчёта рейтингов из recalculate_ratings_for_date для диагностики';



CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "rating" smallint NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_staff" (
    "service_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."service_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "name_ru" "text" NOT NULL,
    "name_ky" "text",
    "duration_min" integer NOT NULL,
    "price_from" integer NOT NULL,
    "price_to" integer NOT NULL,
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "branch_id" "uuid" NOT NULL,
    "name_en" "text",
    CONSTRAINT "services_duration_min_check" CHECK (("duration_min" > 0))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


COMMENT ON TABLE "public"."services" IS 'Услуги бизнеса. Каждая услуга может иметь переводы на киргизский (name_ky) и английский (name_en) языки.';



COMMENT ON COLUMN "public"."services"."name_ky" IS 'Название услуги на киргизском языке';



COMMENT ON COLUMN "public"."services"."name_en" IS 'Название услуги на английском языке';



CREATE TABLE IF NOT EXISTS "public"."staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "skills" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "email" "text",
    "phone" "text",
    "user_id" "uuid",
    "avatar_url" "text",
    "percent_master" numeric(5,2) DEFAULT 60 NOT NULL,
    "percent_salon" numeric(5,2) DEFAULT 40 NOT NULL,
    "hourly_rate" numeric(10,2),
    "rating_score" numeric(5,2),
    "rating_updated_at" timestamp with time zone,
    "last_rating_recalculated_at" timestamp with time zone,
    CONSTRAINT "staff_percent_sum_check" CHECK ((("percent_master" + "percent_salon") = (100)::numeric))
);


ALTER TABLE "public"."staff" OWNER TO "postgres";


COMMENT ON COLUMN "public"."staff"."avatar_url" IS 'URL аватарки сотрудника в Supabase Storage';



COMMENT ON COLUMN "public"."staff"."percent_master" IS 'Процент от чистой суммы (после расходников), который идет мастеру';



COMMENT ON COLUMN "public"."staff"."percent_salon" IS 'Процент от чистой суммы (после расходников), который идет салону';



COMMENT ON COLUMN "public"."staff"."hourly_rate" IS 'Ставка за час работы (сом/час). Если указана, сотрудник получает оплату за выход.';



COMMENT ON COLUMN "public"."staff"."rating_score" IS 'Текущий рейтинг сотрудника (0-100), рассчитанный за последние 30 дней';



COMMENT ON COLUMN "public"."staff"."rating_updated_at" IS 'Время последнего обновления рейтинга';



COMMENT ON COLUMN "public"."staff"."last_rating_recalculated_at" IS 'Время последнего успешного вызова calculate_staff_rating для этого сотрудника';



CREATE TABLE IF NOT EXISTS "public"."staff_day_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "metric_date" "date" NOT NULL,
    "avg_rating" numeric(3,2),
    "reviews_count" integer DEFAULT 0 NOT NULL,
    "clients_count" integer DEFAULT 0 NOT NULL,
    "revenue" numeric(12,2) DEFAULT 0 NOT NULL,
    "returning_clients_count" integer DEFAULT 0 NOT NULL,
    "returning_clients_ratio" numeric(5,2),
    "late_minutes" integer DEFAULT 0 NOT NULL,
    "shifts_with_late" integer DEFAULT 0 NOT NULL,
    "total_shifts" integer DEFAULT 0 NOT NULL,
    "day_score" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."staff_day_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_day_metrics" IS 'Дневные метрики сотрудников для расчета рейтинга';



CREATE TABLE IF NOT EXISTS "public"."staff_finance_operation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "shift_id" "uuid",
    "shift_date" "date",
    "operation_type" "text" NOT NULL,
    "log_level" "text" DEFAULT 'info'::"text" NOT NULL,
    "message" "text" NOT NULL,
    "metadata" "jsonb",
    "before_data" "jsonb",
    "after_data" "jsonb",
    "error_message" "text",
    "error_stack" "text",
    "ip_address" "inet",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "staff_finance_operation_logs_log_level_check" CHECK (("log_level" = ANY (ARRAY['debug'::"text", 'info'::"text", 'warn'::"text", 'error'::"text"]))),
    CONSTRAINT "staff_finance_operation_logs_operation_type_check" CHECK (("operation_type" = ANY (ARRAY['shift_open'::"text", 'shift_close'::"text", 'item_create'::"text", 'item_update'::"text", 'item_delete'::"text", 'items_save'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."staff_finance_operation_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_finance_operation_logs" IS 'Логи операций с финансами для аудита и отладки';



COMMENT ON COLUMN "public"."staff_finance_operation_logs"."operation_type" IS 'Тип операции: shift_open, shift_close, item_create, item_update, item_delete, items_save, error';



COMMENT ON COLUMN "public"."staff_finance_operation_logs"."log_level" IS 'Уровень логирования: debug, info, warn, error';



COMMENT ON COLUMN "public"."staff_finance_operation_logs"."metadata" IS 'Дополнительные данные операции в формате JSON';



COMMENT ON COLUMN "public"."staff_finance_operation_logs"."before_data" IS 'Состояние данных до операции (для аудита)';



COMMENT ON COLUMN "public"."staff_finance_operation_logs"."after_data" IS 'Состояние данных после операции (для аудита)';



COMMENT ON COLUMN "public"."staff_finance_operation_logs"."error_message" IS 'Сообщение об ошибке (если операция завершилась с ошибкой)';



COMMENT ON COLUMN "public"."staff_finance_operation_logs"."error_stack" IS 'Стек ошибки (если операция завершилась с ошибкой)';



CREATE TABLE IF NOT EXISTS "public"."staff_home_branch_changes" (
    "id" bigint NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "from_branch_id" "uuid",
    "to_branch_id" "uuid" NOT NULL,
    "effective_on" "date" NOT NULL,
    "transaction_id" bigint DEFAULT "txid_current"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."staff_home_branch_changes" OWNER TO "postgres";


ALTER TABLE "public"."staff_home_branch_changes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."staff_home_branch_changes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."staff_schedule_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "kind" "public"."schedule_rule_kind" NOT NULL,
    "day_of_week" smallint,
    "date_on" "date",
    "date_from" "date",
    "date_to" "date",
    "branch_id" "uuid" NOT NULL,
    "tz" "text" DEFAULT 'Asia/Bishkek'::"text" NOT NULL,
    "intervals" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "breaks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "staff_schedule_rules_check" CHECK (((("kind" = 'weekly'::"public"."schedule_rule_kind") AND ("day_of_week" IS NOT NULL) AND ("date_on" IS NULL) AND ("date_from" IS NULL) AND ("date_to" IS NULL)) OR (("kind" = 'date'::"public"."schedule_rule_kind") AND ("date_on" IS NOT NULL) AND ("day_of_week" IS NULL) AND ("date_from" IS NULL) AND ("date_to" IS NULL)) OR (("kind" = 'range'::"public"."schedule_rule_kind") AND ("date_from" IS NOT NULL) AND ("date_to" IS NOT NULL) AND ("date_from" <= "date_to") AND ("day_of_week" IS NULL) AND ("date_on" IS NULL)))),
    CONSTRAINT "staff_schedule_rules_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."staff_schedule_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_schedule_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "effective_from" "date" NOT NULL,
    "days" "jsonb" NOT NULL,
    "revision" bigint NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "staff_schedule_versions_kind_check" CHECK (("kind" = ANY (ARRAY['week'::"text", 'day'::"text"]))),
    CONSTRAINT "staff_schedule_versions_revision_check" CHECK (("revision" > 0))
);


ALTER TABLE "public"."staff_schedule_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_shift_aggregates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "period_type" "text" NOT NULL,
    "period_value" "text" NOT NULL,
    "shifts_count" integer DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_master" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_salon" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_late_minutes" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "staff_shift_aggregates_period_type_check" CHECK (("period_type" = ANY (ARRAY['day'::"text", 'month'::"text", 'year'::"text"])))
);


ALTER TABLE "public"."staff_shift_aggregates" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_shift_aggregates" IS 'Предрасчитанные агрегаты статистики по сменам сотрудников для оптимизации запросов';



COMMENT ON COLUMN "public"."staff_shift_aggregates"."period_type" IS 'Тип периода: day (день), month (месяц), year (год)';



COMMENT ON COLUMN "public"."staff_shift_aggregates"."period_value" IS 'Значение периода: YYYY-MM-DD для дня, YYYY-MM для месяца, YYYY для года';



COMMENT ON COLUMN "public"."staff_shift_aggregates"."shifts_count" IS 'Количество закрытых смен в периоде';



COMMENT ON COLUMN "public"."staff_shift_aggregates"."total_amount" IS 'Общая выручка за период';



COMMENT ON COLUMN "public"."staff_shift_aggregates"."total_master" IS 'Общая сумма сотрудника (max(guaranteed_amount, master_share)) за период';



COMMENT ON COLUMN "public"."staff_shift_aggregates"."total_salon" IS 'Общая сумма бизнеса (salon_share - topup_amount) за период';



COMMENT ON COLUMN "public"."staff_shift_aggregates"."total_late_minutes" IS 'Суммарное опоздание в минутах за период';



CREATE TABLE IF NOT EXISTS "public"."staff_shift_expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."staff_shift_expenses" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_shift_expenses" IS 'Расходы (расходники и прочее) по сменам сотрудников';



CREATE TABLE IF NOT EXISTS "public"."staff_shift_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "client_name" "text",
    "service_name" "text",
    "service_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "consumables_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "booking_id" "uuid",
    CONSTRAINT "staff_shift_items_client_name_length" CHECK ((("client_name" IS NULL) OR ("length"("client_name") <= 500))),
    CONSTRAINT "staff_shift_items_consumables_amount_max" CHECK (("consumables_amount" <= 999999999999.99)),
    CONSTRAINT "staff_shift_items_consumables_amount_nonnegative" CHECK (("consumables_amount" >= (0)::numeric)),
    CONSTRAINT "staff_shift_items_note_length" CHECK ((("note" IS NULL) OR ("length"("note") <= 2000))),
    CONSTRAINT "staff_shift_items_service_amount_max" CHECK (("service_amount" <= 999999999999.99)),
    CONSTRAINT "staff_shift_items_service_amount_nonnegative" CHECK (("service_amount" >= (0)::numeric)),
    CONSTRAINT "staff_shift_items_service_name_length" CHECK ((("service_name" IS NULL) OR ("length"("service_name") <= 500)))
);


ALTER TABLE "public"."staff_shift_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_shift_items" IS 'Отдельные операции по клиентам внутри смены сотрудника';



COMMENT ON COLUMN "public"."staff_shift_items"."service_amount" IS 'Сумма за услугу для этого клиента';



COMMENT ON COLUMN "public"."staff_shift_items"."consumables_amount" IS 'Расходники для этого конкретного клиента';



COMMENT ON COLUMN "public"."staff_shift_items"."booking_id" IS 'Связь с записью (booking), если клиент был записан';



COMMENT ON CONSTRAINT "staff_shift_items_client_name_length" ON "public"."staff_shift_items" IS 'Имя клиента не может быть длиннее 500 символов';



COMMENT ON CONSTRAINT "staff_shift_items_consumables_amount_nonnegative" ON "public"."staff_shift_items" IS 'Сумма расходников не может быть отрицательной';



COMMENT ON CONSTRAINT "staff_shift_items_note_length" ON "public"."staff_shift_items" IS 'Примечание не может быть длиннее 2000 символов';



COMMENT ON CONSTRAINT "staff_shift_items_service_amount_max" ON "public"."staff_shift_items" IS 'Максимальная сумма услуги: 999,999,999,999.99';



COMMENT ON CONSTRAINT "staff_shift_items_service_amount_nonnegative" ON "public"."staff_shift_items" IS 'Сумма услуги не может быть отрицательной';



COMMENT ON CONSTRAINT "staff_shift_items_service_name_length" ON "public"."staff_shift_items" IS 'Название услуги не может быть длиннее 500 символов';



CREATE TABLE IF NOT EXISTS "public"."staff_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "branch_id" "uuid" NOT NULL,
    "shift_date" "date" NOT NULL,
    "opened_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "expected_start" timestamp with time zone,
    "late_minutes" integer DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "consumables_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "master_share" numeric(12,2) DEFAULT 0 NOT NULL,
    "salon_share" numeric(12,2) DEFAULT 0 NOT NULL,
    "percent_master" numeric(5,2) DEFAULT 60 NOT NULL,
    "percent_salon" numeric(5,2) DEFAULT 40 NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "hours_worked" numeric(6,2),
    "hourly_rate" numeric(10,2),
    "guaranteed_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "topup_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "staff_shifts_closed_at_required" CHECK ((("status" <> 'closed'::"text") OR ("closed_at" IS NOT NULL))),
    CONSTRAINT "staff_shifts_consumables_amount_max" CHECK (("consumables_amount" <= 999999999999.99)),
    CONSTRAINT "staff_shifts_consumables_amount_nonnegative" CHECK (("consumables_amount" >= (0)::numeric)),
    CONSTRAINT "staff_shifts_guaranteed_amount_max" CHECK (("guaranteed_amount" <= 999999999999.99)),
    CONSTRAINT "staff_shifts_guaranteed_amount_nonnegative" CHECK (("guaranteed_amount" >= (0)::numeric)),
    CONSTRAINT "staff_shifts_hourly_rate_nonnegative" CHECK ((("hourly_rate" IS NULL) OR ("hourly_rate" >= (0)::numeric))),
    CONSTRAINT "staff_shifts_hours_worked_range" CHECK ((("hours_worked" IS NULL) OR (("hours_worked" >= (0)::numeric) AND ("hours_worked" <= (24)::numeric)))),
    CONSTRAINT "staff_shifts_late_minutes_nonnegative" CHECK (("late_minutes" >= 0)),
    CONSTRAINT "staff_shifts_master_share_max" CHECK (("master_share" <= 999999999999.99)),
    CONSTRAINT "staff_shifts_master_share_nonnegative" CHECK (("master_share" >= (0)::numeric)),
    CONSTRAINT "staff_shifts_opened_at_required" CHECK ((("status" <> 'open'::"text") OR ("opened_at" IS NOT NULL))),
    CONSTRAINT "staff_shifts_percent_master_range" CHECK ((("percent_master" >= (0)::numeric) AND ("percent_master" <= (100)::numeric))),
    CONSTRAINT "staff_shifts_percent_salon_range" CHECK ((("percent_salon" >= (0)::numeric) AND ("percent_salon" <= (100)::numeric))),
    CONSTRAINT "staff_shifts_salon_share_max" CHECK (("salon_share" <= 999999999999.99)),
    CONSTRAINT "staff_shifts_salon_share_nonnegative" CHECK (("salon_share" >= (0)::numeric)),
    CONSTRAINT "staff_shifts_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text"]))),
    CONSTRAINT "staff_shifts_topup_amount_max" CHECK (("topup_amount" <= 999999999999.99)),
    CONSTRAINT "staff_shifts_topup_amount_nonnegative" CHECK (("topup_amount" >= (0)::numeric)),
    CONSTRAINT "staff_shifts_total_amount_max" CHECK (("total_amount" <= 999999999999.99)),
    CONSTRAINT "staff_shifts_total_amount_nonnegative" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."staff_shifts" OWNER TO "postgres";


COMMENT ON TABLE "public"."staff_shifts" IS 'Смены сотрудников с финансовыми показателями';



COMMENT ON COLUMN "public"."staff_shifts"."hours_worked" IS 'Количество отработанных часов (от opened_at до closed_at)';



COMMENT ON COLUMN "public"."staff_shifts"."hourly_rate" IS 'Ставка за час на момент закрытия смены (копия из staff.hourly_rate)';



COMMENT ON COLUMN "public"."staff_shifts"."guaranteed_amount" IS 'Гарантированная сумма за выход (hours_worked × hourly_rate)';



COMMENT ON COLUMN "public"."staff_shifts"."topup_amount" IS 'Доплата владельца, если guaranteed_amount > master_share';



COMMENT ON CONSTRAINT "staff_shifts_closed_at_required" ON "public"."staff_shifts" IS 'Закрытая смена должна иметь дату закрытия';



COMMENT ON CONSTRAINT "staff_shifts_consumables_amount_nonnegative" ON "public"."staff_shifts" IS 'Сумма расходников не может быть отрицательной';



COMMENT ON CONSTRAINT "staff_shifts_guaranteed_amount_nonnegative" ON "public"."staff_shifts" IS 'Гарантированная сумма не может быть отрицательной';



COMMENT ON CONSTRAINT "staff_shifts_hours_worked_range" ON "public"."staff_shifts" IS 'Часы работы должны быть в диапазоне 0-24';



COMMENT ON CONSTRAINT "staff_shifts_late_minutes_nonnegative" ON "public"."staff_shifts" IS 'Минуты опоздания не могут быть отрицательными';



COMMENT ON CONSTRAINT "staff_shifts_master_share_nonnegative" ON "public"."staff_shifts" IS 'Доля мастера не может быть отрицательной';



COMMENT ON CONSTRAINT "staff_shifts_opened_at_required" ON "public"."staff_shifts" IS 'Открытая смена должна иметь дату открытия';



COMMENT ON CONSTRAINT "staff_shifts_percent_master_range" ON "public"."staff_shifts" IS 'Процент мастера должен быть в диапазоне 0-100';



COMMENT ON CONSTRAINT "staff_shifts_percent_salon_range" ON "public"."staff_shifts" IS 'Процент салона должен быть в диапазоне 0-100';



COMMENT ON CONSTRAINT "staff_shifts_salon_share_nonnegative" ON "public"."staff_shifts" IS 'Доля салона не может быть отрицательной';



COMMENT ON CONSTRAINT "staff_shifts_topup_amount_nonnegative" ON "public"."staff_shifts" IS 'Доплата не может быть отрицательной';



COMMENT ON CONSTRAINT "staff_shifts_total_amount_max" ON "public"."staff_shifts" IS 'Максимальная сумма выручки: 999,999,999,999.99';



COMMENT ON CONSTRAINT "staff_shifts_total_amount_nonnegative" ON "public"."staff_shifts" IS 'Сумма выручки не может быть отрицательной';



CREATE TABLE IF NOT EXISTS "public"."staff_time_off" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "date_from" "date" NOT NULL,
    "date_to" "date" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    CONSTRAINT "staff_time_off_check" CHECK (("date_from" <= "date_to"))
);


ALTER TABLE "public"."staff_time_off" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."super_admins_legacy" (
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."super_admins_legacy" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_auth_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "event_type" "text" NOT NULL,
    "nonce" "text",
    "telegram_id" bigint,
    "decision" "text",
    "status" "text",
    "user_id" "uuid",
    "linkage" "text",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."telegram_auth_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."telegram_auth_audit_log" IS 'Audit-лог Telegram bot авторизации для mobile deep-link flow.';



COMMENT ON COLUMN "public"."telegram_auth_audit_log"."event_type" IS 'Тип события: mobile_start_created, bot_start_opened, bot_decision_received, bot_login_approved, bot_login_cancelled, bot_login_failed.';



COMMENT ON COLUMN "public"."telegram_auth_audit_log"."nonce" IS 'Идентификатор auth-attempt (одноразовый nonce).';



COMMENT ON COLUMN "public"."telegram_auth_audit_log"."telegram_id" IS 'Telegram user id, от имени которого выполнено действие.';



COMMENT ON COLUMN "public"."telegram_auth_audit_log"."metadata" IS 'Дополнительный контекст события (chatId, ошибка, source и т.д.).';



CREATE TABLE IF NOT EXISTS "public"."telegram_mobile_auth_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nonce" "text" NOT NULL,
    "status" "text" NOT NULL,
    "telegram_id" bigint,
    "user_id" "uuid",
    "exchange_code" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "telegram_mobile_auth_attempts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'consumed'::"text", 'approved'::"text", 'failed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."telegram_mobile_auth_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."telegram_mobile_auth_attempts" IS 'Telegram mobile auth attempts for deep-link sign-in flow.';



COMMENT ON COLUMN "public"."telegram_mobile_auth_attempts"."nonce" IS 'One-time auth attempt nonce from /api/auth/telegram/mobile/start.';



COMMENT ON COLUMN "public"."telegram_mobile_auth_attempts"."status" IS 'Attempt state: pending, consumed, approved, failed, expired.';



COMMENT ON COLUMN "public"."telegram_mobile_auth_attempts"."exchange_code" IS 'One-time mobile exchange code produced after approval.';



COMMENT ON COLUMN "public"."telegram_mobile_auth_attempts"."expires_at" IS 'Attempt expiration timestamp (TTL).';



COMMENT ON COLUMN "public"."telegram_mobile_auth_attempts"."consumed_at" IS 'Timestamp when nonce was consumed by confirm flow.';



CREATE TABLE IF NOT EXISTS "public"."telegram_profile_link_attempts" (
    "token_hash" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "telegram_id" bigint,
    "telegram_username" "text",
    "telegram_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:05:00'::interval) NOT NULL,
    CONSTRAINT "telegram_profile_link_attempts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'cancelled'::"text", 'consumed'::"text", 'expired'::"text"]))),
    CONSTRAINT "telegram_profile_link_attempts_token_hash_check" CHECK (("token_hash" ~ '^[a-f0-9]{64}$'::"text"))
);


ALTER TABLE "public"."telegram_profile_link_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telegram_web_login_attempts" (
    "token_hash" "text" NOT NULL,
    "browser_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "telegram_id" bigint,
    "telegram_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:05:00'::interval) NOT NULL,
    CONSTRAINT "telegram_web_login_attempts_browser_hash_check" CHECK (("browser_hash" ~ '^[a-f0-9]{64}$'::"text")),
    CONSTRAINT "telegram_web_login_attempts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'consumed'::"text", 'cancelled'::"text", 'expired'::"text"]))),
    CONSTRAINT "telegram_web_login_attempts_telegram_id_check" CHECK (("telegram_id" > 0)),
    CONSTRAINT "telegram_web_login_attempts_token_hash_check" CHECK (("token_hash" ~ '^[a-f0-9]{64}$'::"text"))
);


ALTER TABLE "public"."telegram_web_login_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."telegram_web_login_attempts" IS 'Private short-lived browser-bound Telegram login requests. Cleanup expired rows older than one day via service-role maintenance.';



CREATE TABLE IF NOT EXISTS "public"."user_current_business" (
    "user_id" "uuid" NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_current_business" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_current_business" IS 'Текущий выбранный бизнес пользователя (для кабинета владельца/менеджера)';



COMMENT ON COLUMN "public"."user_current_business"."user_id" IS 'ID пользователя (auth.users.id), для которого сохранён текущий бизнес';



COMMENT ON COLUMN "public"."user_current_business"."biz_id" IS 'ID текущего бизнеса пользователя (public.businesses.id)';



COMMENT ON COLUMN "public"."user_current_business"."updated_at" IS 'Время последнего изменения текущего бизнеса (UTC)';



CREATE TABLE IF NOT EXISTS "public"."user_global_roles" (
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_global_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notification_email_sources" (
    "email_id" "uuid" NOT NULL,
    "source" "text" NOT NULL,
    "provider_subject" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_notification_email_sources_source_check" CHECK (("source" = ANY (ARRAY['account'::"text", 'google'::"text", 'yandex'::"text"])))
);


ALTER TABLE "public"."user_notification_email_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notification_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "verified" boolean DEFAULT true NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_notification_emails_normalized" CHECK (("email" = "lower"("btrim"("email"))))
);


ALTER TABLE "public"."user_notification_emails" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_roles_legacy" AS
 SELECT "ur"."user_id",
    "ur"."biz_id",
    "r"."key" AS "role"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")));


ALTER VIEW "public"."user_roles_legacy" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_roles_with_user" AS
 SELECT "ur"."user_id",
    "ur"."biz_id",
    "r"."key" AS "role_key",
    "r"."name" AS "role_name",
    "au"."email",
    "au"."phone",
    NULLIF(("au"."raw_user_meta_data" ->> 'full_name'::"text"), ''::"text") AS "full_name"
   FROM (("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("r"."id" = "ur"."role_id")))
     LEFT JOIN "auth"."users" "au" ON (("au"."id" = "ur"."user_id")));


ALTER VIEW "public"."user_roles_with_user" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."visit_package_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "name_ru" "text" NOT NULL,
    "name_ky" "text",
    "name_en" "text",
    "visit_count" integer NOT NULL,
    "validity_days" integer NOT NULL,
    "discount_type" "public"."visit_package_discount_type" NOT NULL,
    "discount_value" numeric(10,2) NOT NULL,
    "service_id" "uuid",
    "branch_ids" "uuid"[],
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "visit_package_plans_discount_value_check" CHECK (("discount_value" >= (0)::numeric)),
    CONSTRAINT "visit_package_plans_validity_days_check" CHECK (("validity_days" > 0)),
    CONSTRAINT "visit_package_plans_visit_count_check" CHECK (("visit_count" > 0))
);


ALTER TABLE "public"."visit_package_plans" OWNER TO "postgres";


COMMENT ON TABLE "public"."visit_package_plans" IS 'Типы пакетов визитов (шаблоны) по бизнесу';



COMMENT ON COLUMN "public"."visit_package_plans"."visit_count" IS 'Количество визитов в пакете';



COMMENT ON COLUMN "public"."visit_package_plans"."validity_days" IS 'Срок действия в днях с момента продажи';



COMMENT ON COLUMN "public"."visit_package_plans"."discount_type" IS 'Тип: процент скидки или фиксированная цена за визит';



COMMENT ON COLUMN "public"."visit_package_plans"."discount_value" IS 'Процент (0–100) или фиксированная сумма за визит';



COMMENT ON COLUMN "public"."visit_package_plans"."service_id" IS 'null = любая услуга';



COMMENT ON COLUMN "public"."visit_package_plans"."branch_ids" IS 'Массив id филиалов; пустой или null = все филиалы';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "whatsapp_message_id" "text" NOT NULL,
    "from_phone" "text" NOT NULL,
    "to_phone" "text",
    "message_type" "text" NOT NULL,
    "message_text" "text",
    "message_timestamp" timestamp with time zone NOT NULL,
    "client_id" "uuid",
    "booking_id" "uuid",
    "biz_id" "uuid",
    "raw_data" "jsonb",
    "processed" boolean DEFAULT false,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."whatsapp_messages" IS 'Входящие WhatsApp сообщения от клиентов';



COMMENT ON COLUMN "public"."whatsapp_messages"."whatsapp_message_id" IS 'Уникальный ID сообщения от Meta WhatsApp API';



COMMENT ON COLUMN "public"."whatsapp_messages"."from_phone" IS 'Номер отправителя в формате E.164 (например, +996555123456)';



COMMENT ON COLUMN "public"."whatsapp_messages"."message_type" IS 'Тип сообщения: text, image, audio, video, document, location, etc.';



COMMENT ON COLUMN "public"."whatsapp_messages"."message_text" IS 'Текст сообщения (заполняется только для text типа)';



COMMENT ON COLUMN "public"."whatsapp_messages"."client_id" IS 'ID пользователя, если найден по номеру телефона';



COMMENT ON COLUMN "public"."whatsapp_messages"."booking_id" IS 'ID бронирования, если определено по контексту сообщения';



COMMENT ON COLUMN "public"."whatsapp_messages"."raw_data" IS 'Полные данные от Meta для отладки и будущей обработки';



COMMENT ON COLUMN "public"."whatsapp_messages"."processed" IS 'Обработано ли сообщение автоматической системой';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_otp_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "used_at" timestamp with time zone,
    "failed_attempts" integer DEFAULT 0 NOT NULL,
    "locked_until" timestamp with time zone,
    "phone_hash" "text",
    "phone_masked" "text",
    "otp_hash" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "consumed_at" timestamp with time zone,
    CONSTRAINT "whatsapp_otp_codes_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'consumed'::"text", 'approved'::"text", 'failed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."whatsapp_otp_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."whatsapp_otp_codes" IS 'Временное хранилище OTP кодов для аутентификации через WhatsApp';



COMMENT ON COLUMN "public"."whatsapp_otp_codes"."phone" IS 'Номер телефона в формате E.164';



COMMENT ON COLUMN "public"."whatsapp_otp_codes"."code" IS '6-значный OTP код';



COMMENT ON COLUMN "public"."whatsapp_otp_codes"."expires_at" IS 'Время истечения кода';



COMMENT ON COLUMN "public"."whatsapp_otp_codes"."used_at" IS 'Время использования кода (null если не использован)';



CREATE TABLE IF NOT EXISTS "public"."working_hours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "biz_id" "uuid" NOT NULL,
    "staff_id" "uuid" NOT NULL,
    "day_of_week" smallint NOT NULL,
    "intervals" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "breaks" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "exceptions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    CONSTRAINT "working_hours_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6)))
);


ALTER TABLE "public"."working_hours" OWNER TO "postgres";


ALTER TABLE ONLY "public"."account_deletion_requests"
    ADD CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."api_request_metrics"
    ADD CONSTRAINT "api_request_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_moderation_actions"
    ADD CONSTRAINT "application_moderation_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."application_submission_blocks"
    ADD CONSTRAINT "application_submission_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."biz_day_metrics"
    ADD CONSTRAINT "biz_day_metrics_biz_id_metric_date_key" UNIQUE ("biz_id", "metric_date");



ALTER TABLE ONLY "public"."biz_day_metrics"
    ADD CONSTRAINT "biz_day_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_services"
    ADD CONSTRAINT "booking_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branch_admins"
    ADD CONSTRAINT "branch_admins_pkey" PRIMARY KEY ("branch_id", "user_id");



ALTER TABLE ONLY "public"."branch_day_metrics"
    ADD CONSTRAINT "branch_day_metrics_branch_id_metric_date_key" UNIQUE ("branch_id", "metric_date");



ALTER TABLE ONLY "public"."branch_day_metrics"
    ADD CONSTRAINT "branch_day_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branch_promotions"
    ADD CONSTRAINT "branch_promotions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branch_working_hours"
    ADD CONSTRAINT "branch_working_hours_biz_id_branch_id_day_of_week_key" UNIQUE ("biz_id", "branch_id", "day_of_week");



ALTER TABLE ONLY "public"."branch_working_hours"
    ADD CONSTRAINT "branch_working_hours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_creation_audit_log"
    ADD CONSTRAINT "business_creation_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_daily_stats"
    ADD CONSTRAINT "business_daily_stats_pkey" PRIMARY KEY ("biz_id", "date");



ALTER TABLE ONLY "public"."business_hourly_load"
    ADD CONSTRAINT "business_hourly_load_pkey" PRIMARY KEY ("biz_id", "branch_id", "date", "hour");



ALTER TABLE ONLY "public"."business_registration_applications"
    ADD CONSTRAINT "business_registration_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_role_applications"
    ADD CONSTRAINT "business_role_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_promotion_usage"
    ADD CONSTRAINT "client_promotion_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_referrals"
    ADD CONSTRAINT "client_referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_visit_package_uses"
    ADD CONSTRAINT "client_visit_package_uses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_visit_packages"
    ADD CONSTRAINT "client_visit_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_settings_audit_log"
    ADD CONSTRAINT "finance_settings_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."frontend_metrics"
    ADD CONSTRAINT "frontend_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funnel_events"
    ADD CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "no_overlap" EXCLUDE USING "gist" ("staff_id" WITH =, "time_range" WITH &&) WHERE (("status" = ANY (ARRAY['hold'::"public"."booking_status", 'confirmed'::"public"."booking_status", 'paid'::"public"."booking_status"])));



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rating_biz_config"
    ADD CONSTRAINT "rating_biz_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rating_global_config"
    ADD CONSTRAINT "rating_global_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rating_jobs"
    ADD CONSTRAINT "rating_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rating_manual_recalc_log"
    ADD CONSTRAINT "rating_manual_recalc_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rating_recalc_errors"
    ADD CONSTRAINT "rating_recalc_errors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_branch_assignments"
    ADD CONSTRAINT "sba_no_overlap" EXCLUDE USING "gist" ("staff_id" WITH =, "daterange"("valid_from", COALESCE("valid_to", 'infinity'::"date"), '[]'::"text") WITH &&);



ALTER TABLE ONLY "public"."service_staff"
    ADD CONSTRAINT "service_staff_pkey" PRIMARY KEY ("service_id", "staff_id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_branch_assignments"
    ADD CONSTRAINT "staff_branch_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_day_metrics"
    ADD CONSTRAINT "staff_day_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_day_metrics"
    ADD CONSTRAINT "staff_day_metrics_staff_id_metric_date_key" UNIQUE ("staff_id", "metric_date");



ALTER TABLE ONLY "public"."staff_finance_operation_logs"
    ADD CONSTRAINT "staff_finance_operation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_home_branch_changes"
    ADD CONSTRAINT "staff_home_branch_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_schedule_rules"
    ADD CONSTRAINT "staff_schedule_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_schedule_versions"
    ADD CONSTRAINT "staff_schedule_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_schedule_versions"
    ADD CONSTRAINT "staff_schedule_versions_staff_id_revision_key" UNIQUE ("staff_id", "revision");



ALTER TABLE ONLY "public"."staff_shift_aggregates"
    ADD CONSTRAINT "staff_shift_aggregates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_shift_aggregates"
    ADD CONSTRAINT "staff_shift_aggregates_staff_id_period_type_period_value_key" UNIQUE ("staff_id", "period_type", "period_value");



ALTER TABLE ONLY "public"."staff_shift_expenses"
    ADD CONSTRAINT "staff_shift_expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_shift_items"
    ADD CONSTRAINT "staff_shift_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_shifts"
    ADD CONSTRAINT "staff_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_time_off"
    ADD CONSTRAINT "staff_time_off_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."super_admins_legacy"
    ADD CONSTRAINT "super_admins_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."telegram_auth_audit_log"
    ADD CONSTRAINT "telegram_auth_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telegram_mobile_auth_attempts"
    ADD CONSTRAINT "telegram_mobile_auth_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."telegram_profile_link_attempts"
    ADD CONSTRAINT "telegram_profile_link_attempts_pkey" PRIMARY KEY ("token_hash");



ALTER TABLE ONLY "public"."telegram_web_login_attempts"
    ADD CONSTRAINT "telegram_web_login_attempts_pkey" PRIMARY KEY ("token_hash");



ALTER TABLE ONLY "public"."whatsapp_otp_codes"
    ADD CONSTRAINT "unique_active_otp" UNIQUE ("phone", "code", "expires_at");



ALTER TABLE ONLY "public"."user_current_business"
    ADD CONSTRAINT "user_current_business_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_global_roles"
    ADD CONSTRAINT "user_global_roles_pkey" PRIMARY KEY ("user_id", "role_id");



ALTER TABLE ONLY "public"."user_notification_email_sources"
    ADD CONSTRAINT "user_notification_email_sources_pkey" PRIMARY KEY ("email_id", "source");



ALTER TABLE ONLY "public"."user_notification_emails"
    ADD CONSTRAINT "user_notification_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notification_emails"
    ADD CONSTRAINT "user_notification_emails_unique" UNIQUE ("user_id", "email");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_id_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_unique_all" UNIQUE ("user_id", "role_id", "biz_key");



ALTER TABLE ONLY "public"."user_suspensions"
    ADD CONSTRAINT "user_suspensions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."visit_package_plans"
    ADD CONSTRAINT "visit_package_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_whatsapp_message_id_key" UNIQUE ("whatsapp_message_id");



ALTER TABLE ONLY "public"."whatsapp_otp_codes"
    ADD CONSTRAINT "whatsapp_otp_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."working_hours"
    ADD CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id");



CREATE INDEX "account_deletion_requests_due_idx" ON "public"."account_deletion_requests" USING "btree" ("scheduled_for") WHERE ("status" = 'pending'::"text");



CREATE INDEX "analytics_events_biz_date_idx" ON "public"."analytics_events" USING "btree" ("biz_id", "created_at" DESC) WHERE ("biz_id" IS NOT NULL);



CREATE INDEX "analytics_events_branch_date_idx" ON "public"."analytics_events" USING "btree" ("branch_id", "created_at" DESC) WHERE ("branch_id" IS NOT NULL);



CREATE INDEX "analytics_events_created_at_idx" ON "public"."analytics_events" USING "btree" ("created_at" DESC);



CREATE INDEX "analytics_events_session_date_idx" ON "public"."analytics_events" USING "btree" ("session_id", "created_at" DESC) WHERE ("session_id" IS NOT NULL);



CREATE INDEX "analytics_events_type_date_idx" ON "public"."analytics_events" USING "btree" ("event_type", "created_at" DESC);



CREATE INDEX "api_metrics_biz_date_idx" ON "public"."api_request_metrics" USING "btree" ("biz_id", "created_at" DESC) WHERE ("biz_id" IS NOT NULL);



CREATE INDEX "api_metrics_duration_idx" ON "public"."api_request_metrics" USING "btree" ("duration_ms", "created_at" DESC) WHERE ("duration_ms" > 1000);



CREATE INDEX "api_metrics_endpoint_date_idx" ON "public"."api_request_metrics" USING "btree" ("endpoint", "created_at" DESC);



CREATE INDEX "api_metrics_error_type_idx" ON "public"."api_request_metrics" USING "btree" ("error_type", "created_at" DESC) WHERE ("error_type" IS NOT NULL);



CREATE INDEX "api_metrics_staff_date_idx" ON "public"."api_request_metrics" USING "btree" ("staff_id", "created_at" DESC) WHERE ("staff_id" IS NOT NULL);



CREATE INDEX "api_metrics_status_code_idx" ON "public"."api_request_metrics" USING "btree" ("status_code", "created_at" DESC) WHERE ("status_code" >= 400);



CREATE INDEX "application_moderation_actions_application_idx" ON "public"."application_moderation_actions" USING "btree" ("application_kind", "application_id", "created_at" DESC);



CREATE INDEX "application_submission_blocks_lookup_idx" ON "public"."application_submission_blocks" USING "btree" ("application_kind", "subject_user_id", "biz_id", "blocked_until" DESC);



CREATE INDEX "application_submission_blocks_phone_lookup_idx" ON "public"."application_submission_blocks" USING "btree" ("application_kind", "subject_phone", "blocked_until" DESC) WHERE ("subject_phone" IS NOT NULL);



CREATE INDEX "biz_day_metrics_biz_date_idx" ON "public"."biz_day_metrics" USING "btree" ("biz_id", "metric_date" DESC);



CREATE INDEX "bookings_biz_branch_start_at_idx" ON "public"."bookings" USING "btree" ("biz_id", "branch_id", "start_at") WHERE ("status" <> 'cancelled'::"public"."booking_status");



COMMENT ON INDEX "public"."bookings_biz_branch_start_at_idx" IS 'Ускоряет запросы бронирований по бизнесу, филиалу и диапазону дат';



CREATE INDEX "bookings_biz_start_at_idx" ON "public"."bookings" USING "btree" ("biz_id", "start_at" DESC) WHERE ("status" <> 'cancelled'::"public"."booking_status");



COMMENT ON INDEX "public"."bookings_biz_start_at_idx" IS 'Ускоряет запросы бронирований по бизнесу с сортировкой по дате начала';



CREATE INDEX "bookings_biz_status_start_at_idx" ON "public"."bookings" USING "btree" ("biz_id", "status", "start_at" DESC);



COMMENT ON INDEX "public"."bookings_biz_status_start_at_idx" IS 'Ускоряет запросы бронирований по бизнесу и статусу с сортировкой';



CREATE INDEX "bookings_client_created_at_idx" ON "public"."bookings" USING "btree" ("client_id", "created_at" DESC) WHERE ("client_id" IS NOT NULL);



COMMENT ON INDEX "public"."bookings_client_created_at_idx" IS 'Ускоряет поиск последних бронирований клиента по дате создания';



CREATE INDEX "bookings_client_phone_status_start_at_idx" ON "public"."bookings" USING "btree" ("client_phone", "status", "start_at") WHERE ("client_phone" IS NOT NULL);



COMMENT ON INDEX "public"."bookings_client_phone_status_start_at_idx" IS 'Ускоряет запросы гостевых бронирований по телефону, статусу и дате';



CREATE INDEX "bookings_client_status_start_at_idx" ON "public"."bookings" USING "btree" ("client_id", "status", "start_at") WHERE ("client_id" IS NOT NULL);



COMMENT ON INDEX "public"."bookings_client_status_start_at_idx" IS 'Ускоряет запросы бронирований клиента по статусу и дате';



CREATE INDEX "bookings_staff_id_start_at_idx" ON "public"."bookings" USING "btree" ("staff_id", "start_at");



CREATE INDEX "bookings_staff_start_at_idx" ON "public"."bookings" USING "btree" ("staff_id", "start_at") WHERE ("status" <> 'cancelled'::"public"."booking_status");



COMMENT ON INDEX "public"."bookings_staff_start_at_idx" IS 'Ускоряет запросы бронирований сотрудника с сортировкой по дате';



CREATE INDEX "branch_day_metrics_biz_date_idx" ON "public"."branch_day_metrics" USING "btree" ("biz_id", "metric_date" DESC);



CREATE INDEX "branch_day_metrics_branch_date_idx" ON "public"."branch_day_metrics" USING "btree" ("branch_id", "metric_date" DESC);



CREATE INDEX "branch_promotions_biz_id_idx" ON "public"."branch_promotions" USING "btree" ("biz_id");



CREATE INDEX "branch_promotions_branch_active_idx" ON "public"."branch_promotions" USING "btree" ("branch_id", "is_active") WHERE ("is_active" = true);



COMMENT ON INDEX "public"."branch_promotions_branch_active_idx" IS 'Ускоряет запросы активных акций по филиалам';



CREATE INDEX "branch_promotions_branch_id_idx" ON "public"."branch_promotions" USING "btree" ("branch_id");



CREATE INDEX "branch_promotions_is_active_idx" ON "public"."branch_promotions" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "branch_promotions_type_idx" ON "public"."branch_promotions" USING "btree" ("promotion_type");



CREATE INDEX "branch_working_hours_biz_branch_idx" ON "public"."branch_working_hours" USING "btree" ("biz_id", "branch_id");



CREATE INDEX "branch_working_hours_branch_idx" ON "public"."branch_working_hours" USING "btree" ("branch_id");



CREATE INDEX "branches_biz_active_name_idx" ON "public"."branches" USING "btree" ("biz_id", "is_active", "name") WHERE ("is_active" = true);



COMMENT ON INDEX "public"."branches_biz_active_name_idx" IS 'Ускоряет запросы активных филиалов по бизнесу с сортировкой по имени';



CREATE INDEX "branches_lat_idx" ON "public"."branches" USING "btree" ("lat");



CREATE INDEX "branches_lon_idx" ON "public"."branches" USING "btree" ("lon");



CREATE INDEX "branches_rating_score_idx" ON "public"."branches" USING "btree" ("rating_score" DESC NULLS LAST) WHERE ("is_active" = true);



CREATE INDEX "business_creation_audit_log_actor_created_idx" ON "public"."business_creation_audit_log" USING "btree" ("actor_user_id", "created_at" DESC) WHERE ("actor_user_id" IS NOT NULL);



CREATE INDEX "business_creation_audit_log_business_created_idx" ON "public"."business_creation_audit_log" USING "btree" ("business_id", "created_at" DESC);



CREATE INDEX "business_daily_stats_biz_date_idx" ON "public"."business_daily_stats" USING "btree" ("biz_id", "date");



CREATE INDEX "business_daily_stats_date_idx" ON "public"."business_daily_stats" USING "btree" ("date");



CREATE INDEX "business_hourly_load_biz_branch_date_idx" ON "public"."business_hourly_load" USING "btree" ("biz_id", "branch_id", "date");



CREATE INDEX "business_registration_applications_created_business_idx" ON "public"."business_registration_applications" USING "btree" ("created_business_id") WHERE ("created_business_id" IS NOT NULL);



CREATE INDEX "business_registration_applications_phone_created_idx" ON "public"."business_registration_applications" USING "btree" ("phone", "created_at" DESC);



CREATE INDEX "business_registration_applications_status_created_idx" ON "public"."business_registration_applications" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "business_role_applications_biz_status_created_idx" ON "public"."business_role_applications" USING "btree" ("biz_id", "status", "created_at" DESC);



CREATE UNIQUE INDEX "business_role_applications_pending_unique" ON "public"."business_role_applications" USING "btree" ("applicant_user_id", "biz_id", "requested_role") WHERE ("status" = 'pending'::"text");



CREATE INDEX "business_role_applications_user_created_idx" ON "public"."business_role_applications" USING "btree" ("applicant_user_id", "created_at" DESC);



CREATE INDEX "businesses_approved_rating_name_idx" ON "public"."businesses" USING "btree" ("is_approved", "rating_score" DESC NULLS LAST, "name") WHERE ("is_approved" = true);



COMMENT ON INDEX "public"."businesses_approved_rating_name_idx" IS 'Ускоряет запросы одобренных бизнесов с сортировкой по рейтингу и имени';



CREATE INDEX "businesses_city_id_idx" ON "public"."businesses" USING "btree" ("city_id") WHERE ("city_id" IS NOT NULL);



CREATE INDEX "businesses_created_by_user_id_idx" ON "public"."businesses" USING "btree" ("created_by_user_id") WHERE ("created_by_user_id" IS NOT NULL);



CREATE INDEX "businesses_normalized_name_idx" ON "public"."businesses" USING "btree" ("lower"("regexp_replace"("btrim"("name"), '[[:space:]]+'::"text", ' '::"text", 'g'::"text")));



CREATE INDEX "businesses_rating_score_idx" ON "public"."businesses" USING "btree" ("rating_score" DESC NULLS LAST) WHERE ("is_approved" = true);



CREATE INDEX "businesses_source_application_id_idx" ON "public"."businesses" USING "btree" ("source_application_id") WHERE ("source_application_id" IS NOT NULL);



CREATE UNIQUE INDEX "categories_slug_unique" ON "public"."categories" USING "btree" ("lower"("slug"));



CREATE INDEX "client_promotion_usage_booking_idx" ON "public"."client_promotion_usage" USING "btree" ("booking_id");



CREATE INDEX "client_promotion_usage_client_branch_idx" ON "public"."client_promotion_usage" USING "btree" ("client_id", "branch_id");



CREATE INDEX "client_promotion_usage_promotion_idx" ON "public"."client_promotion_usage" USING "btree" ("promotion_id");



CREATE INDEX "client_promotion_usage_type_idx" ON "public"."client_promotion_usage" USING "btree" ("promotion_type");



CREATE INDEX "client_referrals_branch_idx" ON "public"."client_referrals" USING "btree" ("branch_id");



CREATE INDEX "client_referrals_referred_idx" ON "public"."client_referrals" USING "btree" ("referred_id");



CREATE INDEX "client_referrals_referrer_idx" ON "public"."client_referrals" USING "btree" ("referrer_id");



CREATE UNIQUE INDEX "client_referrals_unique_idx" ON "public"."client_referrals" USING "btree" ("referred_id", "branch_id");



CREATE UNIQUE INDEX "client_visit_package_uses_booking_id_key" ON "public"."client_visit_package_uses" USING "btree" ("booking_id");



CREATE INDEX "client_visit_package_uses_package_id_idx" ON "public"."client_visit_package_uses" USING "btree" ("client_visit_package_id");



CREATE INDEX "client_visit_packages_client_valid_idx" ON "public"."client_visit_packages" USING "btree" ("client_id", "valid_until");



CREATE INDEX "client_visit_packages_plan_id_idx" ON "public"."client_visit_packages" USING "btree" ("plan_id");



CREATE INDEX "finance_settings_audit_log_biz_created_idx" ON "public"."finance_settings_audit_log" USING "btree" ("biz_id", "changed_at" DESC);



CREATE INDEX "finance_settings_audit_log_staff_created_idx" ON "public"."finance_settings_audit_log" USING "btree" ("staff_id", "changed_at" DESC);



CREATE INDEX "funnel_events_biz_created_idx" ON "public"."funnel_events" USING "btree" ("biz_id", "created_at");



CREATE INDEX "funnel_events_created_idx" ON "public"."funnel_events" USING "btree" ("created_at");



CREATE INDEX "funnel_events_source_created_idx" ON "public"."funnel_events" USING "btree" ("source", "created_at");



CREATE INDEX "idx_booking_services_booking_id" ON "public"."booking_services" USING "btree" ("booking_id");



CREATE INDEX "idx_booking_services_booking_id_order_index" ON "public"."booking_services" USING "btree" ("booking_id", "order_index");



CREATE INDEX "idx_bookings_biz_start" ON "public"."bookings" USING "btree" ("biz_id", "start_at");



CREATE INDEX "idx_bookings_client_phone" ON "public"."bookings" USING "btree" ("lower"("client_phone"));



CREATE INDEX "idx_bookings_staff_start" ON "public"."bookings" USING "btree" ("staff_id", "start_at");



CREATE INDEX "idx_branch_admins_user" ON "public"."branch_admins" USING "btree" ("user_id");



CREATE INDEX "idx_businesses_address_trgm" ON "public"."businesses" USING "gin" ("address" "public"."gin_trgm_ops");



CREATE INDEX "idx_businesses_categories_gin" ON "public"."businesses" USING "gin" ("categories");



CREATE INDEX "idx_businesses_name_trgm" ON "public"."businesses" USING "gin" ("name" "public"."gin_trgm_ops");



CREATE INDEX "idx_frontend_metrics_created_at" ON "public"."frontend_metrics" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_frontend_metrics_page" ON "public"."frontend_metrics" USING "btree" ("page");



CREATE INDEX "idx_frontend_metrics_type" ON "public"."frontend_metrics" USING "btree" ("metric_type");



CREATE INDEX "idx_frontend_metrics_user_id" ON "public"."frontend_metrics" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_frontend_metrics_web_vitals" ON "public"."frontend_metrics" USING "btree" ((("metric_data" ->> 'name'::"text"))) WHERE ("metric_type" = 'web-vitals'::"text");



CREATE INDEX "idx_profiles_telegram_id" ON "public"."profiles" USING "btree" ("telegram_id");



CREATE INDEX "idx_profiles_yandex_id" ON "public"."profiles" USING "btree" ("yandex_id") WHERE ("yandex_id" IS NOT NULL);



CREATE INDEX "idx_roles_key" ON "public"."roles" USING "btree" ("key");



CREATE INDEX "idx_staff_phone" ON "public"."staff" USING "btree" ("lower"("phone"));



CREATE INDEX "idx_user_global_roles_role" ON "public"."user_global_roles" USING "btree" ("role_id");



CREATE INDEX "idx_user_global_roles_user" ON "public"."user_global_roles" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_biz" ON "public"."user_roles" USING "btree" ("biz_id");



CREATE INDEX "idx_user_roles_biz_user" ON "public"."user_roles" USING "btree" ("biz_id", "user_id");



CREATE INDEX "idx_user_roles_role_id" ON "public"."user_roles" USING "btree" ("role_id");



CREATE INDEX "idx_user_roles_user_biz" ON "public"."user_roles" USING "btree" ("user_id", "biz_id");



CREATE INDEX "idx_whatsapp_messages_biz_id" ON "public"."whatsapp_messages" USING "btree" ("biz_id") WHERE ("biz_id" IS NOT NULL);



CREATE INDEX "idx_whatsapp_messages_booking_id" ON "public"."whatsapp_messages" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);



CREATE INDEX "idx_whatsapp_messages_client_id" ON "public"."whatsapp_messages" USING "btree" ("client_id") WHERE ("client_id" IS NOT NULL);



CREATE INDEX "idx_whatsapp_messages_created_at" ON "public"."whatsapp_messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_whatsapp_messages_from_phone" ON "public"."whatsapp_messages" USING "btree" ("from_phone");



CREATE INDEX "idx_whatsapp_messages_processed" ON "public"."whatsapp_messages" USING "btree" ("processed") WHERE ("processed" = false);



CREATE INDEX "idx_whatsapp_otp_attempt_status" ON "public"."whatsapp_otp_codes" USING "btree" ("phone", "expires_at", "used_at", "failed_attempts");



CREATE INDEX "idx_whatsapp_otp_expires" ON "public"."whatsapp_otp_codes" USING "btree" ("expires_at");



CREATE INDEX "idx_whatsapp_otp_phone" ON "public"."whatsapp_otp_codes" USING "btree" ("phone");



CREATE INDEX "idx_whatsapp_otp_phone_hash" ON "public"."whatsapp_otp_codes" USING "btree" ("phone_hash");



CREATE INDEX "idx_whatsapp_otp_status_expires" ON "public"."whatsapp_otp_codes" USING "btree" ("status", "expires_at");



CREATE INDEX "profiles_phone_idx" ON "public"."profiles" USING "btree" ("phone") WHERE ("phone" IS NOT NULL);



COMMENT ON INDEX "public"."profiles_phone_idx" IS 'Ускоряет поиск профиля по номеру телефона';



CREATE UNIQUE INDEX "profiles_telegram_id_key" ON "public"."profiles" USING "btree" ("telegram_id");



CREATE UNIQUE INDEX "profiles_verified_whatsapp_phone_unique" ON "public"."profiles" USING "btree" ("whatsapp_phone") WHERE (("whatsapp_verified" IS TRUE) AND ("whatsapp_phone" IS NOT NULL));



CREATE UNIQUE INDEX "profiles_yandex_id_unique" ON "public"."profiles" USING "btree" ("yandex_id") WHERE ("yandex_id" IS NOT NULL);



CREATE INDEX "rating_biz_config_biz_active_idx" ON "public"."rating_biz_config" USING "btree" ("biz_id") WHERE ("is_active" = true);



CREATE INDEX "rating_recalc_errors_created_at_idx" ON "public"."rating_recalc_errors" USING "btree" ("created_at" DESC);



CREATE INDEX "rating_recalc_errors_entity_type_date_idx" ON "public"."rating_recalc_errors" USING "btree" ("entity_type", "metric_date");



CREATE INDEX "reviews_booking_id_idx" ON "public"."reviews" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);



COMMENT ON INDEX "public"."reviews_booking_id_idx" IS 'Ускоряет поиск отзыва по бронированию';



CREATE INDEX "reviews_client_created_at_idx" ON "public"."reviews" USING "btree" ("client_id", "created_at" DESC) WHERE ("client_id" IS NOT NULL);



COMMENT ON INDEX "public"."reviews_client_created_at_idx" IS 'Ускоряет запросы отзывов клиента с сортировкой по дате создания';



CREATE INDEX "service_staff_service_active_idx" ON "public"."service_staff" USING "btree" ("service_id", "is_active") WHERE ("is_active" = true);



COMMENT ON INDEX "public"."service_staff_service_active_idx" IS 'Ускоряет запросы активных связей услуги и сотрудников';



CREATE INDEX "service_staff_service_id_idx" ON "public"."service_staff" USING "btree" ("service_id");



CREATE INDEX "service_staff_staff_active_idx" ON "public"."service_staff" USING "btree" ("staff_id", "is_active") WHERE ("is_active" = true);



COMMENT ON INDEX "public"."service_staff_staff_active_idx" IS 'Ускоряет запросы активных связей сотрудника и услуг';



CREATE INDEX "service_staff_staff_id_idx" ON "public"."service_staff" USING "btree" ("staff_id");



CREATE INDEX "services_biz_active_name_idx" ON "public"."services" USING "btree" ("biz_id", "active", "name_ru") WHERE ("active" = true);



COMMENT ON INDEX "public"."services_biz_active_name_idx" IS 'Ускоряет запросы активных услуг по бизнесу с сортировкой по имени';



CREATE INDEX "services_biz_branch_active_idx" ON "public"."services" USING "btree" ("biz_id", "branch_id", "active");



CREATE INDEX "services_biz_branch_name_idx" ON "public"."services" USING "btree" ("biz_id", "branch_id", "name_ru");



CREATE INDEX "staff_biz_active_name_idx" ON "public"."staff" USING "btree" ("biz_id", "is_active", "full_name") WHERE ("is_active" = true);



COMMENT ON INDEX "public"."staff_biz_active_name_idx" IS 'Ускоряет запросы активных сотрудников по бизнесу с сортировкой по имени';



CREATE INDEX "staff_branch_assignments_staff_id_valid_from_idx" ON "public"."staff_branch_assignments" USING "btree" ("staff_id", "valid_from");



CREATE INDEX "staff_day_metrics_biz_date_idx" ON "public"."staff_day_metrics" USING "btree" ("biz_id", "metric_date" DESC);



CREATE INDEX "staff_day_metrics_branch_date_idx" ON "public"."staff_day_metrics" USING "btree" ("branch_id", "metric_date" DESC);



CREATE INDEX "staff_day_metrics_staff_date_idx" ON "public"."staff_day_metrics" USING "btree" ("staff_id", "metric_date" DESC);



CREATE INDEX "staff_finance_logs_biz_date_idx" ON "public"."staff_finance_operation_logs" USING "btree" ("biz_id", "created_at" DESC);



CREATE INDEX "staff_finance_logs_log_level_idx" ON "public"."staff_finance_operation_logs" USING "btree" ("log_level", "created_at" DESC) WHERE ("log_level" = ANY (ARRAY['warn'::"text", 'error'::"text"]));



CREATE INDEX "staff_finance_logs_operation_type_idx" ON "public"."staff_finance_operation_logs" USING "btree" ("operation_type", "created_at" DESC);



CREATE INDEX "staff_finance_logs_shift_date_idx" ON "public"."staff_finance_operation_logs" USING "btree" ("shift_date", "created_at" DESC);



CREATE INDEX "staff_finance_logs_shift_idx" ON "public"."staff_finance_operation_logs" USING "btree" ("shift_id", "created_at" DESC);



CREATE INDEX "staff_finance_logs_staff_date_idx" ON "public"."staff_finance_operation_logs" USING "btree" ("staff_id", "created_at" DESC);



CREATE INDEX "staff_home_branch_changes_lookup" ON "public"."staff_home_branch_changes" USING "btree" ("staff_id", "effective_on" DESC, "id" DESC);



CREATE INDEX "staff_rating_score_idx" ON "public"."staff" USING "btree" ("rating_score" DESC NULLS LAST) WHERE ("is_active" = true);



CREATE INDEX "staff_schedule_rules_biz_staff_active_idx" ON "public"."staff_schedule_rules" USING "btree" ("biz_id", "staff_id", "is_active");



CREATE INDEX "staff_schedule_rules_biz_staff_kind_active_date_idx" ON "public"."staff_schedule_rules" USING "btree" ("biz_id", "staff_id", "kind", "is_active", "date_on") WHERE ("is_active" = true);



COMMENT ON INDEX "public"."staff_schedule_rules_biz_staff_kind_active_date_idx" IS 'Ускоряет запросы правил расписания по бизнесу, сотруднику, типу и дате';



CREATE INDEX "staff_schedule_rules_biz_staff_kind_date_range_idx" ON "public"."staff_schedule_rules" USING "btree" ("biz_id", "staff_id", "kind", "date_on") WHERE (("is_active" = true) AND ("kind" = 'date'::"public"."schedule_rule_kind"));



COMMENT ON INDEX "public"."staff_schedule_rules_biz_staff_kind_date_range_idx" IS 'Ускоряет запросы правил расписания по бизнесу, сотруднику и диапазону дат';



CREATE INDEX "staff_schedule_rules_staff_day_idx" ON "public"."staff_schedule_rules" USING "btree" ("staff_id", "kind", "day_of_week", "date_on", "date_from", "date_to") WHERE "is_active";



CREATE INDEX "staff_schedule_versions_lookup" ON "public"."staff_schedule_versions" USING "btree" ("staff_id", "kind", "effective_from" DESC, "revision" DESC);



CREATE INDEX "staff_shift_aggregates_biz_period_idx" ON "public"."staff_shift_aggregates" USING "btree" ("biz_id", "period_type", "period_value");



CREATE INDEX "staff_shift_aggregates_staff_period_idx" ON "public"."staff_shift_aggregates" USING "btree" ("staff_id", "period_type", "period_value");



CREATE INDEX "staff_shift_aggregates_updated_at_idx" ON "public"."staff_shift_aggregates" USING "btree" ("updated_at");



CREATE INDEX "staff_shift_expenses_shift_idx" ON "public"."staff_shift_expenses" USING "btree" ("shift_id");



CREATE INDEX "staff_shift_items_booking_idx" ON "public"."staff_shift_items" USING "btree" ("booking_id") WHERE ("booking_id" IS NOT NULL);



COMMENT ON INDEX "public"."staff_shift_items_booking_idx" IS 'Ускоряет поиск позиций смен по записи (booking_id)';



CREATE INDEX "staff_shift_items_shift_created_idx" ON "public"."staff_shift_items" USING "btree" ("shift_id", "created_at");



COMMENT ON INDEX "public"."staff_shift_items_shift_created_idx" IS 'Ускоряет сортировку позиций смен по дате создания';



CREATE INDEX "staff_shift_items_shift_idx" ON "public"."staff_shift_items" USING "btree" ("shift_id");



CREATE INDEX "staff_shifts_biz_date_idx" ON "public"."staff_shifts" USING "btree" ("biz_id", "shift_date");



COMMENT ON INDEX "public"."staff_shifts_biz_date_idx" IS 'Ускоряет запросы смен по бизнесу и дате без фильтрации по статусу';



CREATE INDEX "staff_shifts_biz_date_open_idx" ON "public"."staff_shifts" USING "btree" ("biz_id", "shift_date", "status") WHERE ("status" = 'open'::"text");



COMMENT ON INDEX "public"."staff_shifts_biz_date_open_idx" IS 'Ускоряет поиск открытых смен по бизнесу и дате';



CREATE INDEX "staff_shifts_biz_date_status_idx" ON "public"."staff_shifts" USING "btree" ("biz_id", "shift_date", "status") WHERE ("status" = 'closed'::"text");



COMMENT ON INDEX "public"."staff_shifts_biz_date_status_idx" IS 'Ускоряет запросы финансовых отчётов по закрытым сменам';



CREATE INDEX "staff_shifts_biz_staff_date_idx" ON "public"."staff_shifts" USING "btree" ("biz_id", "staff_id", "shift_date");



COMMENT ON INDEX "public"."staff_shifts_biz_staff_date_idx" IS 'Ускоряет запросы смен по бизнесу, сотруднику и диапазону дат';



CREATE INDEX "staff_shifts_staff_date_idx" ON "public"."staff_shifts" USING "btree" ("staff_id", "shift_date");



CREATE UNIQUE INDEX "staff_shifts_staff_date_unique_idx" ON "public"."staff_shifts" USING "btree" ("staff_id", "shift_date");



COMMENT ON INDEX "public"."staff_shifts_staff_date_unique_idx" IS 'Предотвращает создание дубликатов смен для одного сотрудника на одну дату';



CREATE INDEX "staff_shifts_staff_id_shift_date_idx" ON "public"."staff_shifts" USING "btree" ("staff_id", "shift_date");



CREATE INDEX "staff_time_off_active_staff_dates_idx" ON "public"."staff_time_off" USING "btree" ("staff_id", "date_from", "date_to") WHERE ("cancelled_at" IS NULL);



CREATE INDEX "staff_time_off_staff_range_idx" ON "public"."staff_time_off" USING "btree" ("staff_id", "date_from", "date_to");



CREATE UNIQUE INDEX "staff_user_business_unique" ON "public"."staff" USING "btree" ("user_id", "biz_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "staff_user_id_idx" ON "public"."staff" USING "btree" ("user_id");



CREATE INDEX "telegram_auth_audit_log_created_idx" ON "public"."telegram_auth_audit_log" USING "btree" ("created_at" DESC);



CREATE INDEX "telegram_auth_audit_log_nonce_idx" ON "public"."telegram_auth_audit_log" USING "btree" ("nonce", "created_at" DESC) WHERE ("nonce" IS NOT NULL);



CREATE INDEX "telegram_auth_audit_log_telegram_idx" ON "public"."telegram_auth_audit_log" USING "btree" ("telegram_id", "created_at" DESC) WHERE ("telegram_id" IS NOT NULL);



CREATE UNIQUE INDEX "telegram_mobile_auth_attempts_nonce_uidx" ON "public"."telegram_mobile_auth_attempts" USING "btree" ("nonce");



CREATE INDEX "telegram_mobile_auth_attempts_status_expires_idx" ON "public"."telegram_mobile_auth_attempts" USING "btree" ("status", "expires_at");



CREATE INDEX "telegram_profile_link_attempts_expires_at_idx" ON "public"."telegram_profile_link_attempts" USING "btree" ("expires_at");



CREATE INDEX "telegram_profile_link_attempts_owner_id_created_at_idx" ON "public"."telegram_profile_link_attempts" USING "btree" ("owner_id", "created_at");



CREATE INDEX "telegram_web_login_expiry_idx" ON "public"."telegram_web_login_attempts" USING "btree" ("expires_at");



CREATE INDEX "user_current_business_biz_id_idx" ON "public"."user_current_business" USING "btree" ("biz_id");



CREATE INDEX "user_notification_emails_user_enabled_idx" ON "public"."user_notification_emails" USING "btree" ("user_id", "enabled") WHERE "verified";



CREATE UNIQUE INDEX "user_roles_uniq" ON "public"."user_roles" USING "btree" ("user_id", "role_id", "biz_id");



CREATE UNIQUE INDEX "user_roles_unique_triplet" ON "public"."user_roles" USING "btree" ("user_id", "role_id", "biz_id");



CREATE UNIQUE INDEX "user_roles_uq_triplet_global" ON "public"."user_roles" USING "btree" ("user_id", "biz_id", "role_id") WHERE ("biz_id" IS NULL);



CREATE UNIQUE INDEX "user_roles_uq_triplet_scoped" ON "public"."user_roles" USING "btree" ("user_id", "biz_id", "role_id") WHERE ("biz_id" IS NOT NULL);



CREATE INDEX "user_roles_user_biz_role" ON "public"."user_roles" USING "btree" ("user_id", "biz_id", "role_id");



CREATE INDEX "user_roles_user_global_role" ON "public"."user_roles" USING "btree" ("user_id", "role_id") WHERE ("biz_id" IS NULL);



CREATE UNIQUE INDEX "ux_user_roles_business" ON "public"."user_roles" USING "btree" ("user_id", "biz_id", "role_id") WHERE ("biz_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_user_roles_platform" ON "public"."user_roles" USING "btree" ("user_id", "role_id") WHERE ("biz_id" IS NULL);



CREATE INDEX "visit_package_plans_biz_id_idx" ON "public"."visit_package_plans" USING "btree" ("biz_id");



CREATE INDEX "visit_package_plans_is_active_idx" ON "public"."visit_package_plans" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE OR REPLACE TRIGGER "bookings_analytics_events_insert" AFTER INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."log_booking_analytics_event"();



CREATE OR REPLACE TRIGGER "bookings_analytics_events_update" AFTER UPDATE OF "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."log_booking_analytics_event"();



CREATE OR REPLACE TRIGGER "bookings_branch_guard" BEFORE INSERT OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."check_booking_branch_match"();



CREATE OR REPLACE TRIGGER "branches_apply_registration_links" BEFORE INSERT ON "public"."branches" FOR EACH ROW EXECUTE FUNCTION "public"."apply_registration_links_to_first_branch"();



CREATE OR REPLACE TRIGGER "branches_enforce_business_limit" BEFORE INSERT ON "public"."branches" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_business_branch_limit"();



CREATE OR REPLACE TRIGGER "business_registration_application_policy" BEFORE INSERT ON "public"."business_registration_applications" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_business_registration_application_policy"();



CREATE OR REPLACE TRIGGER "business_role_application_policy" BEFORE INSERT ON "public"."business_role_applications" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_business_role_application_policy"();



CREATE OR REPLACE TRIGGER "businesses_audit_creation" AFTER INSERT ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."audit_business_creation"();



CREATE OR REPLACE TRIGGER "check_explicit_schedule_booking" BEFORE INSERT OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."check_explicit_schedule_booking"();



CREATE OR REPLACE TRIGGER "guard_legacy_staff_schedule_write" BEFORE INSERT OR DELETE OR UPDATE ON "public"."staff_schedule_rules" FOR EACH ROW EXECUTE FUNCTION "public"."guard_legacy_staff_schedule_write"();



CREATE OR REPLACE TRIGGER "guard_legacy_working_hours_write" BEFORE INSERT OR DELETE OR UPDATE ON "public"."working_hours" FOR EACH ROW EXECUTE FUNCTION "public"."guard_legacy_staff_schedule_write"();



CREATE OR REPLACE TRIGGER "guard_staff_absence_booking" BEFORE INSERT OR UPDATE ON "public"."staff_time_off" FOR EACH ROW EXECUTE FUNCTION "public"."guard_staff_absence_booking"();



CREATE OR REPLACE TRIGGER "guard_staff_home_change" BEFORE UPDATE OF "branch_id" ON "public"."staff" FOR EACH ROW EXECUTE FUNCTION "public"."guard_staff_home_change"();



CREATE OR REPLACE TRIGGER "log_shift_close" AFTER UPDATE ON "public"."staff_shifts" FOR EACH ROW WHEN ((("new"."status" = 'closed'::"text") AND ("old"."status" = 'open'::"text"))) EXECUTE FUNCTION "public"."log_shift_close_trigger"();



CREATE OR REPLACE TRIGGER "log_shift_items" AFTER INSERT OR DELETE OR UPDATE ON "public"."staff_shift_items" FOR EACH ROW EXECUTE FUNCTION "public"."log_shift_items_trigger"();



CREATE OR REPLACE TRIGGER "log_shift_open" AFTER INSERT OR UPDATE ON "public"."staff_shifts" FOR EACH ROW WHEN (("new"."status" = 'open'::"text")) EXECUTE FUNCTION "public"."log_shift_open_trigger"();



CREATE OR REPLACE TRIGGER "prevent_existing_business_application" BEFORE INSERT OR UPDATE OF "business_name" ON "public"."business_registration_applications" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_application_for_existing_business"();



CREATE OR REPLACE TRIGGER "set_timestamp_updated_at" BEFORE UPDATE ON "public"."branch_promotions" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp_updated_at" BEFORE UPDATE ON "public"."staff_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp_updated_at_biz_day_metrics" BEFORE UPDATE ON "public"."biz_day_metrics" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp_updated_at_branch_day_metrics" BEFORE UPDATE ON "public"."branch_day_metrics" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp_updated_at_rating_biz_config" BEFORE UPDATE ON "public"."rating_biz_config" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp_updated_at_rating_config" BEFORE UPDATE ON "public"."rating_global_config" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp_updated_at_staff_day_metrics" BEFORE UPDATE ON "public"."staff_day_metrics" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "set_timestamp_visit_package_plans" BEFORE UPDATE ON "public"."visit_package_plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_timestamp_updated_at"();



CREATE OR REPLACE TRIGGER "trg_business_owner_not_suspended" BEFORE INSERT OR UPDATE OF "owner_id" ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."check_owner_not_suspended"();



CREATE OR REPLACE TRIGGER "trg_guard_last_super_admin" BEFORE DELETE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."guard_last_super_admin"();



CREATE OR REPLACE TRIGGER "trg_prevent_owner_suspended" BEFORE INSERT OR UPDATE OF "owner_id" ON "public"."businesses" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_owner_suspended"();



CREATE OR REPLACE TRIGGER "trg_prevent_roles_for_suspended" BEFORE INSERT OR UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_roles_for_suspended"();



CREATE OR REPLACE TRIGGER "trg_reviews_set_client_id" BEFORE INSERT OR UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."reviews_set_client_id"();



CREATE OR REPLACE TRIGGER "trg_user_current_business_set_updated_at" BEFORE UPDATE ON "public"."user_current_business" FOR EACH ROW EXECUTE FUNCTION "public"."user_current_business_set_updated_at"();



ALTER TABLE ONLY "public"."api_request_metrics"
    ADD CONSTRAINT "api_request_metrics_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."api_request_metrics"
    ADD CONSTRAINT "api_request_metrics_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."api_request_metrics"
    ADD CONSTRAINT "api_request_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."application_moderation_actions"
    ADD CONSTRAINT "application_moderation_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."application_moderation_actions"
    ADD CONSTRAINT "application_moderation_actions_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."application_moderation_actions"
    ADD CONSTRAINT "application_moderation_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."application_submission_blocks"
    ADD CONSTRAINT "application_submission_blocks_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."application_submission_blocks"
    ADD CONSTRAINT "application_submission_blocks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."application_submission_blocks"
    ADD CONSTRAINT "application_submission_blocks_released_by_fkey" FOREIGN KEY ("released_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."application_submission_blocks"
    ADD CONSTRAINT "application_submission_blocks_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."biz_day_metrics"
    ADD CONSTRAINT "biz_day_metrics_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_services"
    ADD CONSTRAINT "booking_services_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_services"
    ADD CONSTRAINT "booking_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."branch_admins"
    ADD CONSTRAINT "branch_admins_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branch_day_metrics"
    ADD CONSTRAINT "branch_day_metrics_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branch_day_metrics"
    ADD CONSTRAINT "branch_day_metrics_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branch_promotions"
    ADD CONSTRAINT "branch_promotions_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branch_promotions"
    ADD CONSTRAINT "branch_promotions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branch_working_hours"
    ADD CONSTRAINT "branch_working_hours_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branch_working_hours"
    ADD CONSTRAINT "branch_working_hours_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_creation_audit_log"
    ADD CONSTRAINT "business_creation_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_creation_audit_log"
    ADD CONSTRAINT "business_creation_audit_log_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "public"."business_registration_applications"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_creation_audit_log"
    ADD CONSTRAINT "business_creation_audit_log_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_daily_stats"
    ADD CONSTRAINT "business_daily_stats_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_hourly_load"
    ADD CONSTRAINT "business_hourly_load_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_hourly_load"
    ADD CONSTRAINT "business_hourly_load_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_registration_applications"
    ADD CONSTRAINT "business_registration_applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_registration_applications"
    ADD CONSTRAINT "business_registration_applications_created_business_id_fkey" FOREIGN KEY ("created_business_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_registration_applications"
    ADD CONSTRAINT "business_registration_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."business_role_applications"
    ADD CONSTRAINT "business_role_applications_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_role_applications"
    ADD CONSTRAINT "business_role_applications_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."business_role_applications"
    ADD CONSTRAINT "business_role_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."businesses"
    ADD CONSTRAINT "businesses_source_application_id_fkey" FOREIGN KEY ("source_application_id") REFERENCES "public"."business_registration_applications"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_promotion_usage"
    ADD CONSTRAINT "client_promotion_usage_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_promotion_usage"
    ADD CONSTRAINT "client_promotion_usage_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_promotion_usage"
    ADD CONSTRAINT "client_promotion_usage_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_promotion_usage"
    ADD CONSTRAINT "client_promotion_usage_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_promotion_usage"
    ADD CONSTRAINT "client_promotion_usage_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "public"."branch_promotions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_referrals"
    ADD CONSTRAINT "client_referrals_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_referrals"
    ADD CONSTRAINT "client_referrals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_referrals"
    ADD CONSTRAINT "client_referrals_referred_booking_id_fkey" FOREIGN KEY ("referred_booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_referrals"
    ADD CONSTRAINT "client_referrals_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_referrals"
    ADD CONSTRAINT "client_referrals_referrer_booking_id_fkey" FOREIGN KEY ("referrer_booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_referrals"
    ADD CONSTRAINT "client_referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_visit_package_uses"
    ADD CONSTRAINT "client_visit_package_uses_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_visit_package_uses"
    ADD CONSTRAINT "client_visit_package_uses_client_visit_package_id_fkey" FOREIGN KEY ("client_visit_package_id") REFERENCES "public"."client_visit_packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_visit_packages"
    ADD CONSTRAINT "client_visit_packages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_visit_packages"
    ADD CONSTRAINT "client_visit_packages_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."visit_package_plans"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."finance_settings_audit_log"
    ADD CONSTRAINT "finance_settings_audit_log_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."finance_settings_audit_log"
    ADD CONSTRAINT "finance_settings_audit_log_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finance_settings_audit_log"
    ADD CONSTRAINT "finance_settings_audit_log_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."frontend_metrics"
    ADD CONSTRAINT "frontend_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."funnel_events"
    ADD CONSTRAINT "funnel_events_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rating_biz_config"
    ADD CONSTRAINT "rating_biz_config_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_staff"
    ADD CONSTRAINT "service_staff_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_staff"
    ADD CONSTRAINT "service_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_day_metrics"
    ADD CONSTRAINT "staff_day_metrics_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_day_metrics"
    ADD CONSTRAINT "staff_day_metrics_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_day_metrics"
    ADD CONSTRAINT "staff_day_metrics_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_finance_operation_logs"
    ADD CONSTRAINT "staff_finance_operation_logs_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_finance_operation_logs"
    ADD CONSTRAINT "staff_finance_operation_logs_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."staff_shifts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_finance_operation_logs"
    ADD CONSTRAINT "staff_finance_operation_logs_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_home_branch_changes"
    ADD CONSTRAINT "staff_home_branch_changes_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."staff_home_branch_changes"
    ADD CONSTRAINT "staff_home_branch_changes_from_branch_id_fkey" FOREIGN KEY ("from_branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."staff_home_branch_changes"
    ADD CONSTRAINT "staff_home_branch_changes_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."staff_home_branch_changes"
    ADD CONSTRAINT "staff_home_branch_changes_to_branch_id_fkey" FOREIGN KEY ("to_branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."staff_schedule_rules"
    ADD CONSTRAINT "staff_schedule_rules_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_schedule_rules"
    ADD CONSTRAINT "staff_schedule_rules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."staff_schedule_rules"
    ADD CONSTRAINT "staff_schedule_rules_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_schedule_versions"
    ADD CONSTRAINT "staff_schedule_versions_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id");



ALTER TABLE ONLY "public"."staff_schedule_versions"
    ADD CONSTRAINT "staff_schedule_versions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id");



ALTER TABLE ONLY "public"."staff_schedule_versions"
    ADD CONSTRAINT "staff_schedule_versions_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id");



ALTER TABLE ONLY "public"."staff_shift_aggregates"
    ADD CONSTRAINT "staff_shift_aggregates_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_shift_aggregates"
    ADD CONSTRAINT "staff_shift_aggregates_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_shift_expenses"
    ADD CONSTRAINT "staff_shift_expenses_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."staff_shifts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_shift_items"
    ADD CONSTRAINT "staff_shift_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_shift_items"
    ADD CONSTRAINT "staff_shift_items_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."staff_shifts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_shifts"
    ADD CONSTRAINT "staff_shifts_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_shifts"
    ADD CONSTRAINT "staff_shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_shifts"
    ADD CONSTRAINT "staff_shifts_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_time_off"
    ADD CONSTRAINT "staff_time_off_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_time_off"
    ADD CONSTRAINT "staff_time_off_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff"
    ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."super_admins_legacy"
    ADD CONSTRAINT "super_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."telegram_auth_audit_log"
    ADD CONSTRAINT "telegram_auth_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."telegram_mobile_auth_attempts"
    ADD CONSTRAINT "telegram_mobile_auth_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."telegram_profile_link_attempts"
    ADD CONSTRAINT "telegram_profile_link_attempts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_current_business"
    ADD CONSTRAINT "user_current_business_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_current_business"
    ADD CONSTRAINT "user_current_business_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_global_roles"
    ADD CONSTRAINT "user_global_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_global_roles"
    ADD CONSTRAINT "user_global_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notification_email_sources"
    ADD CONSTRAINT "user_notification_email_sources_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "public"."user_notification_emails"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notification_emails"
    ADD CONSTRAINT "user_notification_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_suspensions"
    ADD CONSTRAINT "user_suspensions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_suspensions"
    ADD CONSTRAINT "user_suspensions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_package_plans"
    ADD CONSTRAINT "visit_package_plans_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visit_package_plans"
    ADD CONSTRAINT "visit_package_plans_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_messages"
    ADD CONSTRAINT "whatsapp_messages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."working_hours"
    ADD CONSTRAINT "working_hours_biz_id_fkey" FOREIGN KEY ("biz_id") REFERENCES "public"."businesses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."working_hours"
    ADD CONSTRAINT "working_hours_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE CASCADE;



CREATE POLICY "API metrics select own" ON "public"."api_request_metrics" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("staff_id" IN ( SELECT "staff"."id"
   FROM "public"."staff"
  WHERE ("staff"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow insert access to frontend metrics" ON "public"."frontend_metrics" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow insert for OTP codes" ON "public"."whatsapp_otp_codes" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow read access to frontend metrics" ON "public"."frontend_metrics" FOR SELECT USING (true);



CREATE POLICY "Analytics events select all for service_role" ON "public"."analytics_events" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Biz can manage client visit packages" ON "public"."client_visit_packages" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."visit_package_plans" "p"
  WHERE (("p"."id" = "client_visit_packages"."plan_id") AND ("p"."biz_id" IN ( SELECT "ur"."biz_id"
           FROM ("public"."user_roles" "ur"
             JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])))))))) OR "public"."is_super_admin"())) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."visit_package_plans" "p"
  WHERE (("p"."id" = "client_visit_packages"."plan_id") AND ("p"."biz_id" IN ( SELECT "ur"."biz_id"
           FROM ("public"."user_roles" "ur"
             JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])))))))) OR "public"."is_super_admin"()));



CREATE POLICY "Biz can view visit package uses" ON "public"."client_visit_package_uses" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."client_visit_packages" "cvp"
     JOIN "public"."visit_package_plans" "p" ON (("p"."id" = "cvp"."plan_id")))
  WHERE (("cvp"."id" = "client_visit_package_uses"."client_visit_package_id") AND ("p"."biz_id" IN ( SELECT "ur"."biz_id"
           FROM ("public"."user_roles" "ur"
             JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])))))))) OR "public"."is_super_admin"()));



CREATE POLICY "Biz day metrics select owners" ON "public"."biz_day_metrics" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "biz_day_metrics"."biz_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Biz owners/admins/managers can manage branch promotions" ON "public"."branch_promotions" TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



CREATE POLICY "Biz owners/admins/managers can manage visit package plans" ON "public"."visit_package_plans" TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



CREATE POLICY "Biz owners/admins/managers can view promotion usage" ON "public"."client_promotion_usage" FOR SELECT TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



CREATE POLICY "Biz owners/admins/managers can view referrals" ON "public"."client_referrals" FOR SELECT TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



CREATE POLICY "Branch day metrics select owners" ON "public"."branch_day_metrics" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "branch_day_metrics"."biz_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Business managers can manage staff_branch_assignments" ON "public"."staff_branch_assignments" TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



CREATE POLICY "Business managers can manage staff_schedule_rules" ON "public"."staff_schedule_rules" TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



CREATE POLICY "Business managers can manage staff_time_off" ON "public"."staff_time_off" TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



CREATE POLICY "Business managers can view business_daily_stats" ON "public"."business_daily_stats" FOR SELECT TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



CREATE POLICY "Business managers can view business_hourly_load" ON "public"."business_hourly_load" FOR SELECT TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



CREATE POLICY "Business owners and managers can delete branch working hours" ON "public"."branch_working_hours" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "branch_working_hours"."biz_id") AND (("b"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM ("public"."user_roles" "ur"
             JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
          WHERE (("ur"."biz_id" = "b"."id") AND ("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'manager'::"text"]))))))))));



CREATE POLICY "Business owners and managers can insert branch working hours" ON "public"."branch_working_hours" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "branch_working_hours"."biz_id") AND (("b"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM ("public"."user_roles" "ur"
             JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
          WHERE (("ur"."biz_id" = "b"."id") AND ("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'manager'::"text"]))))))))));



CREATE POLICY "Business owners and managers can select branch working hours" ON "public"."branch_working_hours" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "branch_working_hours"."biz_id") AND (("b"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM ("public"."user_roles" "ur"
             JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
          WHERE (("ur"."biz_id" = "b"."id") AND ("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'manager'::"text"]))))))))));



CREATE POLICY "Business owners and managers can update branch working hours" ON "public"."branch_working_hours" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "branch_working_hours"."biz_id") AND (("b"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM ("public"."user_roles" "ur"
             JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
          WHERE (("ur"."biz_id" = "b"."id") AND ("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'manager'::"text"])))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "branch_working_hours"."biz_id") AND (("b"."owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM ("public"."user_roles" "ur"
             JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
          WHERE (("ur"."biz_id" = "b"."id") AND ("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'manager'::"text"]))))))))));



CREATE POLICY "Business owners can manage own branches" ON "public"."branches" TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



COMMENT ON POLICY "Business owners can manage own branches" ON "public"."branches" IS 'Владельцы могут управлять только филиалами своих бизнесов';



CREATE POLICY "Business owners can manage own services" ON "public"."services" TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



COMMENT ON POLICY "Business owners can manage own services" ON "public"."services" IS 'Владельцы могут управлять только услугами своих бизнесов';



CREATE POLICY "Business owners can manage own staff" ON "public"."staff" TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



COMMENT ON POLICY "Business owners can manage own staff" ON "public"."staff" IS 'Владельцы могут управлять только сотрудниками своих бизнесов';



CREATE POLICY "Business owners can manage service_staff" ON "public"."service_staff" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM (("public"."services" "svc"
     JOIN "public"."user_roles" "ur" ON (("ur"."biz_id" = "svc"."biz_id")))
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("svc"."id" = "service_staff"."service_id") AND ("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK (((EXISTS ( SELECT 1
   FROM (("public"."services" "svc"
     JOIN "public"."user_roles" "ur" ON (("ur"."biz_id" = "svc"."biz_id")))
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("svc"."id" = "service_staff"."service_id") AND ("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



CREATE POLICY "Business owners can manage staff shift items" ON "public"."staff_shift_items" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ((("public"."staff_shifts" "sh"
     JOIN "public"."staff" "s" ON (("s"."id" = "sh"."staff_id")))
     JOIN "public"."user_roles" "ur" ON (("ur"."biz_id" = "s"."biz_id")))
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("sh"."id" = "staff_shift_items"."shift_id") AND ("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK (((EXISTS ( SELECT 1
   FROM ((("public"."staff_shifts" "sh"
     JOIN "public"."staff" "s" ON (("s"."id" = "sh"."staff_id")))
     JOIN "public"."user_roles" "ur" ON (("ur"."biz_id" = "s"."biz_id")))
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("sh"."id" = "staff_shift_items"."shift_id") AND ("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



COMMENT ON POLICY "Business owners can manage staff shift items" ON "public"."staff_shift_items" IS 'Владельцы, админы и менеджеры могут редактировать позиции смен своих сотрудников';



CREATE POLICY "Business owners can manage staff shifts" ON "public"."staff_shifts" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM (("public"."staff" "s"
     JOIN "public"."user_roles" "ur" ON (("ur"."biz_id" = "s"."biz_id")))
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("s"."id" = "staff_shifts"."staff_id") AND ("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK (((EXISTS ( SELECT 1
   FROM (("public"."staff" "s"
     JOIN "public"."user_roles" "ur" ON (("ur"."biz_id" = "s"."biz_id")))
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("s"."id" = "staff_shifts"."staff_id") AND ("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



CREATE POLICY "Business owners can update own bookings" ON "public"."bookings" FOR UPDATE TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



CREATE POLICY "Business owners can update own businesses" ON "public"."businesses" FOR UPDATE TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."biz_id" = "businesses"."id") AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))) OR "public"."is_super_admin"())) WITH CHECK ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."biz_id" = "businesses"."id") AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))) OR "public"."is_super_admin"()));



COMMENT ON POLICY "Business owners can update own businesses" ON "public"."businesses" IS 'Владельцы могут обновлять только свои бизнесы';



CREATE POLICY "Business owners can view booking_services" ON "public"."booking_services" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."id" = "booking_services"."booking_id") AND (("b"."biz_id" IN ( SELECT "ur"."biz_id"
           FROM ("public"."user_roles" "ur"
             JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"())))));



CREATE POLICY "Business owners can view own bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



COMMENT ON POLICY "Business owners can view own bookings" ON "public"."bookings" IS 'Владельцы могут видеть бронирования своих бизнесов';



CREATE POLICY "Business owners can view own branches" ON "public"."branches" FOR SELECT TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



COMMENT ON POLICY "Business owners can view own branches" ON "public"."branches" IS 'Владельцы могут видеть только филиалы своих бизнесов';



CREATE POLICY "Business owners can view own businesses" ON "public"."businesses" FOR SELECT TO "authenticated" USING ((("owner_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."biz_id" = "businesses"."id") AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



COMMENT ON POLICY "Business owners can view own businesses" ON "public"."businesses" IS 'Владельцы могут видеть только свои бизнесы';



CREATE POLICY "Business owners can view own services" ON "public"."services" FOR SELECT TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



COMMENT ON POLICY "Business owners can view own services" ON "public"."services" IS 'Владельцы могут видеть только услуги своих бизнесов';



CREATE POLICY "Business owners can view own staff" ON "public"."staff" FOR SELECT TO "authenticated" USING ((("biz_id" IN ( SELECT "ur"."biz_id"
   FROM ("public"."user_roles" "ur"
     JOIN "public"."roles" "r" ON (("ur"."role_id" = "r"."id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("r"."key" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))) OR "public"."is_super_admin"()));



COMMENT ON POLICY "Business owners can view own staff" ON "public"."staff" IS 'Владельцы могут видеть только сотрудников своих бизнесов';



CREATE POLICY "Clients can create own bookings" ON "public"."bookings" FOR INSERT TO "authenticated" WITH CHECK ((("client_id" = "auth"."uid"()) OR ("client_id" IS NULL)));



CREATE POLICY "Clients can update own bookings" ON "public"."bookings" FOR UPDATE TO "authenticated" USING ((("client_id" = "auth"."uid"()) OR (("client_phone" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."phone" = "bookings"."client_phone"))))))) WITH CHECK ((("client_id" = "auth"."uid"()) OR (("client_phone" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."phone" = "bookings"."client_phone")))))));



CREATE POLICY "Clients can view own booking_services" ON "public"."booking_services" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."id" = "booking_services"."booking_id") AND (("b"."client_id" = "auth"."uid"()) OR (("b"."client_phone" IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM "public"."profiles" "p"
          WHERE (("p"."id" = "auth"."uid"()) AND ("p"."phone" = "b"."client_phone"))))))))));



CREATE POLICY "Clients can view own bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((("client_id" = "auth"."uid"()) OR (("client_phone" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."phone" = "bookings"."client_phone")))))));



COMMENT ON POLICY "Clients can view own bookings" ON "public"."bookings" IS 'Клиенты могут видеть только свои бронирования';



CREATE POLICY "Clients can view own promotion usage" ON "public"."client_promotion_usage" FOR SELECT TO "authenticated" USING (("client_id" = "auth"."uid"()));



CREATE POLICY "Clients can view own referrals" ON "public"."client_referrals" FOR SELECT TO "authenticated" USING ((("referrer_id" = "auth"."uid"()) OR ("referred_id" = "auth"."uid"())));



CREATE POLICY "Clients can view own visit package uses" ON "public"."client_visit_package_uses" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."client_visit_packages" "cvp"
  WHERE (("cvp"."id" = "client_visit_package_uses"."client_visit_package_id") AND ("cvp"."client_id" = "auth"."uid"())))));



CREATE POLICY "Clients can view own visit packages" ON "public"."client_visit_packages" FOR SELECT TO "authenticated" USING (("client_id" = "auth"."uid"()));



CREATE POLICY "Finance logs select own" ON "public"."staff_finance_operation_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."staff" "s"
  WHERE (("s"."id" = "staff_finance_operation_logs"."staff_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."is_active" = true)))));



CREATE POLICY "Managers can view audit log for their biz" ON "public"."finance_settings_audit_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles_with_user" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."biz_id" = "finance_settings_audit_log"."biz_id") AND ("ur"."role_key" = ANY (ARRAY['owner'::"text", 'manager'::"text"]))))));



CREATE POLICY "Public can view active branch promotions" ON "public"."branch_promotions" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND (("valid_from" IS NULL) OR ("valid_from" <= CURRENT_DATE)) AND (("valid_to" IS NULL) OR ("valid_to" >= CURRENT_DATE))));



CREATE POLICY "Public can view active branches" ON "public"."branches" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND ("biz_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."is_approved" = true)))));



CREATE POLICY "Public can view active services" ON "public"."services" FOR SELECT TO "authenticated", "anon" USING ((("active" = true) AND ("biz_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."is_approved" = true)))));



CREATE POLICY "Public can view active staff" ON "public"."staff" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND ("biz_id" IN ( SELECT "businesses"."id"
   FROM "public"."businesses"
  WHERE ("businesses"."is_approved" = true)))));



CREATE POLICY "Public can view approved businesses" ON "public"."businesses" FOR SELECT TO "authenticated", "anon" USING (("is_approved" = true));



CREATE POLICY "Rating biz config modify owners and superadmin" ON "public"."rating_biz_config" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "rating_biz_config"."biz_id") AND ("b"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles_with_user" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_key" = 'super_admin'::"text") AND ("ur"."biz_id" IS NULL)))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "rating_biz_config"."biz_id") AND ("b"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles_with_user" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_key" = 'super_admin'::"text") AND ("ur"."biz_id" IS NULL))))));



CREATE POLICY "Rating biz config select owners and superadmin" ON "public"."rating_biz_config" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "rating_biz_config"."biz_id") AND ("b"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles_with_user" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_key" = 'super_admin'::"text") AND ("ur"."biz_id" IS NULL))))));



CREATE POLICY "Rating config modify superadmin" ON "public"."rating_global_config" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles_with_user" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_key" = 'super_admin'::"text") AND ("ur"."biz_id" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles_with_user" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_key" = 'super_admin'::"text") AND ("ur"."biz_id" IS NULL)))));



CREATE POLICY "Rating config select all" ON "public"."rating_global_config" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Rating jobs superadmin" ON "public"."rating_jobs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles_with_user" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_key" = 'super_admin'::"text") AND ("ur"."biz_id" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles_with_user" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_key" = 'super_admin'::"text") AND ("ur"."biz_id" IS NULL)))));



CREATE POLICY "Rating manual recalc log superadmin" ON "public"."rating_manual_recalc_log" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles_with_user" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_key" = 'super_admin'::"text") AND ("ur"."biz_id" IS NULL))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles_with_user" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_key" = 'super_admin'::"text") AND ("ur"."biz_id" IS NULL)))));



CREATE POLICY "Rating recalc errors select superadmin" ON "public"."rating_recalc_errors" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles_with_user" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_key" = 'super_admin'::"text") AND ("ur"."biz_id" IS NULL)))));



CREATE POLICY "Staff can update own profile" ON "public"."staff" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "Staff can update own profile" ON "public"."staff" IS 'Сотрудники могут обновлять только свой профиль';



CREATE POLICY "Staff can view booking_services" ON "public"."booking_services" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."bookings" "b"
     JOIN "public"."staff" "s" ON (("s"."id" = "b"."staff_id")))
  WHERE (("b"."id" = "booking_services"."booking_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."is_active" = true)))));



CREATE POLICY "Staff can view own bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."staff" "s"
  WHERE (("s"."id" = "bookings"."staff_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."is_active" = true)))));



COMMENT ON POLICY "Staff can view own bookings" ON "public"."bookings" IS 'Сотрудники могут видеть бронирования, где они назначены';



CREATE POLICY "Staff can view own profile" ON "public"."staff" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "Staff can view own profile" ON "public"."staff" IS 'Сотрудники могут видеть только свой профиль';



CREATE POLICY "Staff can view own schedule_rules" ON "public"."staff_schedule_rules" FOR SELECT TO "authenticated" USING (("staff_id" IN ( SELECT "s"."id"
   FROM "public"."staff" "s"
  WHERE ("s"."user_id" = "auth"."uid"()))));



CREATE POLICY "Staff day metrics select owners" ON "public"."staff_day_metrics" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "staff_day_metrics"."biz_id") AND ("b"."owner_id" = "auth"."uid"())))));



CREATE POLICY "Staff shift aggregates all" ON "public"."staff_shift_aggregates" TO "authenticated", "anon", "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Staff shift aggregates own all" ON "public"."staff_shift_aggregates" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."staff" "s"
  WHERE (("s"."id" = "staff_shift_aggregates"."staff_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."staff" "s"
  WHERE (("s"."id" = "staff_shift_aggregates"."staff_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."is_active" = true)))));



CREATE POLICY "Staff shift aggregates service_role all" ON "public"."staff_shift_aggregates" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Staff shift expenses own" ON "public"."staff_shift_expenses" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."staff_shifts" "sh"
     JOIN "public"."staff" "s" ON (("s"."id" = "sh"."staff_id")))
  WHERE (("sh"."id" = "staff_shift_expenses"."shift_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."staff_shifts" "sh"
     JOIN "public"."staff" "s" ON (("s"."id" = "sh"."staff_id")))
  WHERE (("sh"."id" = "staff_shift_expenses"."shift_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."is_active" = true)))));



CREATE POLICY "Staff shift items own" ON "public"."staff_shift_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."staff_shifts" "sh"
     JOIN "public"."staff" "s" ON (("s"."id" = "sh"."staff_id")))
  WHERE (("sh"."id" = "staff_shift_items"."shift_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."staff_shifts" "sh"
     JOIN "public"."staff" "s" ON (("s"."id" = "sh"."staff_id")))
  WHERE (("sh"."id" = "staff_shift_items"."shift_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."is_active" = true)))));



CREATE POLICY "Staff shifts modify own" ON "public"."staff_shifts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."staff" "s"
  WHERE (("s"."id" = "staff_shifts"."staff_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."staff" "s"
  WHERE (("s"."id" = "staff_shifts"."staff_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."is_active" = true)))));



CREATE POLICY "Staff shifts select own" ON "public"."staff_shifts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."staff" "s"
  WHERE (("s"."id" = "staff_shifts"."staff_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."is_active" = true)))));



CREATE POLICY "Super admins can manage all booking_services" ON "public"."booking_services" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admins can manage all bookings" ON "public"."bookings" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admins can manage all branches" ON "public"."branches" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admins can manage all businesses" ON "public"."businesses" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admins can manage all service_staff" ON "public"."service_staff" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admins can manage all services" ON "public"."services" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Super admins can manage all staff" ON "public"."staff" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "Telegram auth audit insert service role" ON "public"."telegram_auth_audit_log" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Telegram auth audit select service role" ON "public"."telegram_auth_audit_log" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Users can delete own current business" ON "public"."user_current_business" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own current business" ON "public"."user_current_business" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert own reviews" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK ((("client_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE (("b"."id" = "reviews"."booking_id") AND ("b"."client_id" = "auth"."uid"()))))));



COMMENT ON POLICY "Users can insert own reviews" ON "public"."reviews" IS 'Пользователи могут создавать отзывы только для своих бронирований';



CREATE POLICY "Users can select own current business" ON "public"."user_current_business" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can select own reviews" ON "public"."reviews" FOR SELECT TO "authenticated" USING ((("client_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM (("public"."bookings" "b"
     JOIN "public"."staff" "s" ON (("s"."id" = "b"."staff_id")))
     JOIN "public"."businesses" "biz" ON (("biz"."id" = "s"."biz_id")))
  WHERE (("b"."id" = "reviews"."booking_id") AND ("biz"."owner_id" = "auth"."uid"()))))));



COMMENT ON POLICY "Users can select own reviews" ON "public"."reviews" IS 'Пользователи могут читать свои отзывы, владельцы бизнесов - отзывы для своих сотрудников';



CREATE POLICY "Users can update own current business" ON "public"."user_current_business" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own reviews" ON "public"."reviews" FOR UPDATE TO "authenticated" USING (("client_id" = "auth"."uid"())) WITH CHECK (("client_id" = "auth"."uid"()));



COMMENT ON POLICY "Users can update own reviews" ON "public"."reviews" IS 'Пользователи могут обновлять только свои отзывы';



CREATE POLICY "Users can view own notification email sources" ON "public"."user_notification_email_sources" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_notification_emails" "email"
  WHERE (("email"."id" = "user_notification_email_sources"."email_id") AND ("email"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own notification emails" ON "public"."user_notification_emails" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own messages" ON "public"."whatsapp_messages" FOR SELECT USING ((("client_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "whatsapp_messages"."biz_id") AND ("b"."owner_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."branch_admins" "ba"
  WHERE (("ba"."branch_id" IN ( SELECT "branches"."id"
           FROM "public"."branches"
          WHERE ("branches"."biz_id" = "whatsapp_messages"."biz_id"))) AND ("ba"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."account_deletion_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."api_request_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."application_moderation_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."application_submission_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "biz delete" ON "public"."bookings" FOR DELETE USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."biz_id" = "bookings"."biz_id"))))));



CREATE POLICY "biz update" ON "public"."bookings" FOR UPDATE USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."biz_id" = "bookings"."biz_id"))))));



ALTER TABLE "public"."biz_day_metrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "biz_super_cud" ON "public"."businesses" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "biz_super_select" ON "public"."businesses" FOR SELECT USING ("public"."is_super_admin"());



ALTER TABLE "public"."booking_services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_insert_client" ON "public"."bookings" FOR INSERT TO "authenticated" WITH CHECK (("client_id" = "auth"."uid"()));



CREATE POLICY "bookings_select_client" ON "public"."bookings" FOR SELECT TO "authenticated" USING (("client_id" = "auth"."uid"()));



CREATE POLICY "bookings_srv_cascade_upd" ON "public"."bookings" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (true);



CREATE POLICY "br_super_cud" ON "public"."branches" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "br_super_select" ON "public"."branches" FOR SELECT USING ("public"."is_super_admin"());



ALTER TABLE "public"."branch_admins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "branch_admins_manage_by_branch" ON "public"."branch_admins" TO "authenticated" USING ("public"."has_branch_admin"("branch_id")) WITH CHECK ("public"."has_branch_admin"("branch_id"));



ALTER TABLE "public"."branch_day_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branch_promotions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branch_working_hours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_creation_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_daily_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_hourly_load" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_registration_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."business_role_applications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."businesses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "businesses_srv_cascade_upd" ON "public"."businesses" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (true);



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories select" ON "public"."categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "categories_public_active_select" ON "public"."categories" FOR SELECT TO "anon" USING (("is_active" IS TRUE));



CREATE POLICY "client insert hold" ON "public"."bookings" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("client_id" = "auth"."uid"()) AND ("status" = 'hold'::"public"."booking_status")));



CREATE POLICY "client reads own bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING (("client_id" = "auth"."uid"()));



ALTER TABLE "public"."client_promotion_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_referrals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_visit_package_uses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_visit_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_settings_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."frontend_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."funnel_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "manage bookings by role" ON "public"."bookings" TO "authenticated" USING (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id") OR "public"."has_role"('manager'::"text", "biz_id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid"))) WITH CHECK (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id") OR "public"."has_role"('manager'::"text", "biz_id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid")));



CREATE POLICY "manage branches by role" ON "public"."branches" TO "authenticated" USING (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id") OR "public"."has_role"('manager'::"text", "biz_id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid"))) WITH CHECK (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id") OR "public"."has_role"('manager'::"text", "biz_id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid")));



CREATE POLICY "manage businesses by role" ON "public"."businesses" TO "authenticated" USING (("public"."has_role"('owner'::"text", "id") OR "public"."has_role"('admin'::"text", "id") OR "public"."has_role"('manager'::"text", "id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid"))) WITH CHECK (("public"."has_role"('owner'::"text", "id") OR "public"."has_role"('admin'::"text", "id") OR "public"."has_role"('manager'::"text", "id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid")));



CREATE POLICY "manage service_staff by role" ON "public"."service_staff" TO "authenticated" USING (("public"."has_role"('owner'::"text", ( SELECT "s"."biz_id"
   FROM "public"."staff" "s"
  WHERE ("s"."id" = "service_staff"."staff_id"))) OR "public"."has_role"('admin'::"text", ( SELECT "s"."biz_id"
   FROM "public"."staff" "s"
  WHERE ("s"."id" = "service_staff"."staff_id"))) OR "public"."has_role"('manager'::"text", ( SELECT "s"."biz_id"
   FROM "public"."staff" "s"
  WHERE ("s"."id" = "service_staff"."staff_id"))) OR "public"."has_role"('super_admin'::"text", NULL::"uuid"))) WITH CHECK (("public"."has_role"('owner'::"text", ( SELECT "s"."biz_id"
   FROM "public"."staff" "s"
  WHERE ("s"."id" = "service_staff"."staff_id"))) OR "public"."has_role"('admin'::"text", ( SELECT "s"."biz_id"
   FROM "public"."staff" "s"
  WHERE ("s"."id" = "service_staff"."staff_id"))) OR "public"."has_role"('manager'::"text", ( SELECT "s"."biz_id"
   FROM "public"."staff" "s"
  WHERE ("s"."id" = "service_staff"."staff_id"))) OR "public"."has_role"('super_admin'::"text", NULL::"uuid")));



CREATE POLICY "manage services by role" ON "public"."services" TO "authenticated" USING (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id") OR "public"."has_role"('manager'::"text", "biz_id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid"))) WITH CHECK (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id") OR "public"."has_role"('manager'::"text", "biz_id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid")));



CREATE POLICY "manage staff by role" ON "public"."staff" TO "authenticated" USING (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id") OR "public"."has_role"('manager'::"text", "biz_id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid"))) WITH CHECK (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id") OR "public"."has_role"('manager'::"text", "biz_id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid")));



CREATE POLICY "manage working hours by role" ON "public"."working_hours" USING ((("auth"."uid"() IS NOT NULL) AND ("public"."has_role"("auth"."uid"(), "biz_id", 'owner'::"text") OR "public"."has_role"("auth"."uid"(), "biz_id", 'admin'::"text") OR "public"."has_role"("auth"."uid"(), "biz_id", 'manager'::"text")))) WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("public"."has_role"("auth"."uid"(), "biz_id", 'owner'::"text") OR "public"."has_role"("auth"."uid"(), "biz_id", 'admin'::"text") OR "public"."has_role"("auth"."uid"(), "biz_id", 'manager'::"text"))));



CREATE POLICY "manage working_hours by role" ON "public"."working_hours" TO "authenticated" USING (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id") OR "public"."has_role"('manager'::"text", "biz_id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid"))) WITH CHECK (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id") OR "public"."has_role"('manager'::"text", "biz_id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid")));



CREATE POLICY "manage_staff_by_branch" ON "public"."staff" TO "authenticated" USING ("public"."has_branch_admin"("branch_id")) WITH CHECK ("public"."has_branch_admin"("branch_id"));



CREATE POLICY "me: select my roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "owner_can_manage_staff_shifts" ON "public"."staff_shifts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."staff" "s"
     JOIN "public"."businesses" "b" ON (("b"."id" = "s"."biz_id")))
  WHERE (("s"."id" = "staff_shifts"."staff_id") AND ("b"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."staff" "s"
     JOIN "public"."businesses" "b" ON (("b"."id" = "s"."biz_id")))
  WHERE (("s"."id" = "staff_shifts"."staff_id") AND ("b"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rating_biz_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rating_global_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rating_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rating_manual_recalc_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rating_recalc_errors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read approved businesses" ON "public"."businesses" FOR SELECT USING (("is_approved" = true));



CREATE POLICY "read bookings by biz or client" ON "public"."bookings" FOR SELECT USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."biz_id" = "bookings"."biz_id")))) OR ("auth"."uid"() = "client_id")));



CREATE POLICY "read bookings by participants" ON "public"."bookings" FOR SELECT TO "authenticated" USING (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id") OR "public"."has_role"('manager'::"text", "biz_id") OR "public"."has_role"('staff'::"text", "biz_id") OR "public"."has_role"('super_admin'::"text", NULL::"uuid")));



CREATE POLICY "read branches of approved business" ON "public"."branches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "branches"."biz_id") AND ("b"."is_approved" = true)))));



CREATE POLICY "read my bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING (("client_id" = "auth"."uid"()));



CREATE POLICY "read service_staff of approved business" ON "public"."service_staff" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM ("public"."services" "s"
     JOIN "public"."businesses" "b" ON (("b"."id" = "s"."biz_id")))
  WHERE (("s"."id" = "service_staff"."service_id") AND ("b"."is_approved" = true)))) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."services" "s" ON (("s"."id" = "service_staff"."service_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."biz_id" = "s"."biz_id"))))));



CREATE POLICY "read services of approved business" ON "public"."services" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "services"."biz_id") AND ("b"."is_approved" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."biz_id" = "services"."biz_id"))))));



CREATE POLICY "read staff of approved business" ON "public"."staff" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "staff"."biz_id") AND ("b"."is_approved" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."biz_id" = "staff"."biz_id"))))));



CREATE POLICY "read super_admins (auth)" ON "public"."super_admins_legacy" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read working hours of approved business" ON "public"."working_hours" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."businesses" "b"
  WHERE (("b"."id" = "working_hours"."biz_id") AND ("b"."is_approved" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."biz_id" = "working_hours"."biz_id"))))));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_delete_self" ON "public"."reviews" FOR DELETE USING ("public"."can_edit_review"("id"));



CREATE POLICY "reviews_insert_self" ON "public"."reviews" FOR INSERT WITH CHECK ("public"."can_review"("booking_id"));



CREATE POLICY "reviews_select_self" ON "public"."reviews" FOR SELECT USING (("client_id" = "auth"."uid"()));



CREATE POLICY "reviews_update_self" ON "public"."reviews" FOR UPDATE USING ("public"."can_edit_review"("id")) WITH CHECK ("public"."can_edit_review"("id"));



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_select_all" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "roles_select_self" ON "public"."user_roles" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "roles_write_super" ON "public"."roles" TO "authenticated" USING ("public"."has_role"('super_admin'::"text", NULL::"uuid")) WITH CHECK ("public"."has_role"('super_admin'::"text", NULL::"uuid"));



ALTER TABLE "public"."service_staff" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_staff_read" ON "public"."service_staff" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."services" "s"
  WHERE (("s"."id" = "service_staff"."service_id") AND ("public"."has_role"('owner'::"text", "s"."biz_id") OR "public"."has_role"('admin'::"text", "s"."biz_id") OR "public"."has_role"('manager'::"text", "s"."biz_id"))))));



CREATE POLICY "service_staff_write" ON "public"."service_staff" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."services" "s"
     JOIN "public"."staff" "st" ON (("st"."id" = "service_staff"."staff_id")))
  WHERE (("s"."id" = "service_staff"."service_id") AND ("s"."biz_id" = "st"."biz_id") AND ("public"."has_role"('owner'::"text", "s"."biz_id") OR "public"."has_role"('admin'::"text", "s"."biz_id") OR "public"."has_role"('manager'::"text", "s"."biz_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."services" "s"
     JOIN "public"."staff" "st" ON (("st"."id" = "service_staff"."staff_id")))
  WHERE (("s"."id" = "service_staff"."service_id") AND ("s"."biz_id" = "st"."biz_id") AND ("public"."has_role"('owner'::"text", "s"."biz_id") OR "public"."has_role"('admin'::"text", "s"."biz_id") OR "public"."has_role"('manager'::"text", "s"."biz_id"))))));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "srv_del_super_admins_legacy" ON "public"."super_admins_legacy" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "srv_del_user_global_roles" ON "public"."user_global_roles" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "srv_del_user_roles" ON "public"."user_roles" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "srv_upd_bookings" ON "public"."bookings" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (true);



CREATE POLICY "srv_upd_businesses" ON "public"."businesses" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (true);



CREATE POLICY "srv_upd_staff" ON "public"."staff" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (true);



ALTER TABLE "public"."staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_branch_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_day_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_finance_operation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_home_branch_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_schedule_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_schedule_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_shift_aggregates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_shift_expenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_shift_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staff_shifts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_srv_cascade_upd" ON "public"."staff" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (true);



ALTER TABLE "public"."staff_time_off" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."super_admins_legacy" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super_admins_legacy_srv_cascade_del" ON "public"."super_admins_legacy" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "super_all" ON "public"."bookings" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_all" ON "public"."branches" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_all" ON "public"."businesses" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_all" ON "public"."service_staff" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_all" ON "public"."services" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_all" ON "public"."staff" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_all" ON "public"."working_hours" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



ALTER TABLE "public"."telegram_auth_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telegram_profile_link_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telegram_web_login_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update business by role" ON "public"."businesses" FOR UPDATE USING ((("auth"."uid"() IS NOT NULL) AND ("public"."has_role"("auth"."uid"(), "id", 'owner'::"text") OR "public"."has_role"("auth"."uid"(), "id", 'admin'::"text") OR "public"."has_role"("auth"."uid"(), "id", 'manager'::"text"))));



ALTER TABLE "public"."user_current_business" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_global_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_global_roles_srv_cascade_del" ON "public"."user_global_roles" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."user_notification_email_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notification_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_roles_manage_by_biz_admin" ON "public"."user_roles" TO "authenticated" USING (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id"))) WITH CHECK (("public"."has_role"('owner'::"text", "biz_id") OR "public"."has_role"('admin'::"text", "biz_id")));



CREATE POLICY "user_roles_manage_super" ON "public"."user_roles" TO "authenticated" USING ("public"."has_role"('super_admin'::"text", NULL::"uuid")) WITH CHECK ("public"."has_role"('super_admin'::"text", NULL::"uuid"));



CREATE POLICY "user_roles_select_self_or_super" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("public"."has_role"('super_admin'::"text", NULL::"uuid") OR ("auth"."uid"() = "user_id")));



CREATE POLICY "user_roles_srv_cascade_del" ON "public"."user_roles" FOR DELETE USING (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "public"."user_suspensions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_suspensions_self_read" ON "public"."user_suspensions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "user_suspensions_srv_all" ON "public"."user_suspensions" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (true);



ALTER TABLE "public"."visit_package_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_otp_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."working_hours" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("path") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("point") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."addauth"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."anonymize_inactive_profiles_pii"("p_inactive_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."anonymize_inactive_profiles_pii"("p_inactive_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."anonymize_inactive_profiles_pii"("p_inactive_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."anonymize_old_bookings_pii"("p_older_than_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."anonymize_old_bookings_pii"("p_older_than_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."anonymize_old_bookings_pii"("p_older_than_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_promotion_to_booking"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_promotion_to_booking"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_promotion_to_booking"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_registration_links_to_first_branch"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_registration_links_to_first_branch"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_registration_links_to_first_branch"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_visit_package_to_booking"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_visit_package_to_booking"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_visit_package_to_booking"("p_booking_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."approve_staff_application"("p_application_id" "uuid", "p_reviewer_user_id" "uuid", "p_branch_id" "uuid", "p_is_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."approve_staff_application"("p_application_id" "uuid", "p_reviewer_user_id" "uuid", "p_branch_id" "uuid", "p_is_active" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_business_owner"("p_biz_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_business_owner"("p_biz_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_business_owner"("p_biz_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_business_creation"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_business_creation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_business_creation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."booking_receipt_public"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."booking_receipt_public"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."booking_receipt_public"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."booking_receipt_public"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."booking_view_public"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."booking_view_public"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."booking_view_public"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."branch_admins_effective"("p_branch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."branches_sync_lat_lon_from_coords"() TO "anon";
GRANT ALL ON FUNCTION "public"."branches_sync_lat_lon_from_coords"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."branches_sync_lat_lon_from_coords"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_biz_day_metrics"("p_biz_id" "uuid", "p_metric_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_biz_day_metrics"("p_biz_id" "uuid", "p_metric_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_biz_day_metrics"("p_biz_id" "uuid", "p_metric_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_biz_rating"("p_biz_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_biz_rating"("p_biz_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_biz_rating"("p_biz_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_branch_day_metrics"("p_branch_id" "uuid", "p_metric_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_branch_day_metrics"("p_branch_id" "uuid", "p_metric_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_branch_day_metrics"("p_branch_id" "uuid", "p_metric_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_branch_rating"("p_branch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_branch_rating"("p_branch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_branch_rating"("p_branch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_staff_day_metrics"("p_staff_id" "uuid", "p_metric_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_staff_day_metrics"("p_staff_id" "uuid", "p_metric_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_staff_day_metrics"("p_staff_id" "uuid", "p_metric_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_staff_rating"("p_staff_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_staff_rating"("p_staff_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_staff_rating"("p_staff_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_edit_review"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_edit_review"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_edit_review"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_review"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_review"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_review"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_use_promotion"("p_client_id" "uuid", "p_branch_id" "uuid", "p_promotion_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_use_promotion"("p_client_id" "uuid", "p_branch_id" "uuid", "p_promotion_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_use_promotion"("p_client_id" "uuid", "p_branch_id" "uuid", "p_promotion_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_booking"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_booking"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_booking"("p_booking_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_business_role_application"("p_application_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_business_role_application"("p_application_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "postgres";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "anon";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cat_remove_slug"("the_slug" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cat_remove_slug"("the_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cat_remove_slug"("the_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cat_remove_slug"("the_slug" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cat_replace_slug"("old_slug" "text", "new_slug" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cat_replace_slug"("old_slug" "text", "new_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cat_replace_slug"("old_slug" "text", "new_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cat_replace_slug"("old_slug" "text", "new_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."categories_with_usage_v2"() TO "anon";
GRANT ALL ON FUNCTION "public"."categories_with_usage_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."categories_with_usage_v2"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_booking_branch_match"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_booking_branch_match"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_booking_branch_match"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_explicit_schedule_booking"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_explicit_schedule_booking"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_owner_not_suspended"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_owner_not_suspended"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_owner_not_suspended"() TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_telegram_mobile_auth_attempts"("p_keep_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_telegram_mobile_auth_attempts"("p_keep_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_telegram_mobile_auth_attempts"("p_keep_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_whatsapp_otp_codes"("p_keep_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_whatsapp_otp_codes"("p_keep_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_whatsapp_otp_codes"("p_keep_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_api_metrics"("p_keep_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_api_metrics"("p_keep_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_api_metrics"("p_keep_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_finance_logs"("p_keep_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_finance_logs"("p_keep_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_finance_logs"("p_keep_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_old_funnel_events"("p_keep_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_old_funnel_events"("p_keep_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cleanup_telegram_profile_links"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cleanup_telegram_profile_links"() TO "service_role";



GRANT ALL ON FUNCTION "public"."clear_business_owner"("p_biz_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."clear_business_owner"("p_biz_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."clear_business_owner"("p_biz_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."close_staff_shift_safe"("p_shift_id" "uuid", "p_total_amount" numeric, "p_consumables_amount" numeric, "p_percent_master" numeric, "p_percent_salon" numeric, "p_master_share" numeric, "p_salon_share" numeric, "p_hours_worked" numeric, "p_hourly_rate" numeric, "p_guaranteed_amount" numeric, "p_topup_amount" numeric, "p_closed_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."close_staff_shift_safe"("p_shift_id" "uuid", "p_total_amount" numeric, "p_consumables_amount" numeric, "p_percent_master" numeric, "p_percent_salon" numeric, "p_master_share" numeric, "p_salon_share" numeric, "p_hours_worked" numeric, "p_hourly_rate" numeric, "p_guaranteed_amount" numeric, "p_topup_amount" numeric, "p_closed_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."close_staff_shift_safe"("p_shift_id" "uuid", "p_total_amount" numeric, "p_consumables_amount" numeric, "p_percent_master" numeric, "p_percent_salon" numeric, "p_master_share" numeric, "p_salon_share" numeric, "p_hours_worked" numeric, "p_hourly_rate" numeric, "p_guaranteed_amount" numeric, "p_topup_amount" numeric, "p_closed_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_booking"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_booking"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_booking"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_internal_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_minutes" integer, "p_client_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_internal_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_minutes" integer, "p_client_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_internal_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_minutes" integer, "p_client_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_internal_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_minutes" integer, "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_internal_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_minutes" integer, "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_internal_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_minutes" integer, "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_internal_complex_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_internal_complex_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_internal_complex_booking"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb", "p_client_id" "uuid", "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "postgres";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "anon";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_business_cascade"("p_biz_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_business_cascade"("p_biz_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_business_cascade"("p_biz_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_business_cascade"("p_biz_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."dev_become_superadmin"() TO "anon";
GRANT ALL ON FUNCTION "public"."dev_become_superadmin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dev_become_superadmin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_business_branch_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_business_branch_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_business_branch_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_business_registration_application_policy"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_business_registration_application_policy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_business_registration_application_policy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_business_role_application_policy"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_business_role_application_policy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_business_role_application_policy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."exec_grant_owner"("p_biz_id" "uuid", "p_user_id" "uuid", "p_role_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."exec_grant_owner"("p_biz_id" "uuid", "p_user_id" "uuid", "p_role_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."exec_grant_owner"("p_biz_id" "uuid", "p_user_id" "uuid", "p_role_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_due_account_deletions"("batch_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_due_account_deletions"("batch_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "postgres";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "anon";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "service_role";



GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."force_delete_business_and_downgrade_owner"("p_biz_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."force_delete_business_and_downgrade_owner"("p_biz_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."force_delete_business_and_downgrade_owner"("p_biz_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_api_metrics_stats"("p_endpoint" "text", "p_window_minutes" integer, "p_method" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_api_metrics_stats"("p_endpoint" "text", "p_window_minutes" integer, "p_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_api_metrics_stats"("p_endpoint" "text", "p_window_minutes" integer, "p_method" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_applicable_visit_package_for_booking"("p_booking_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_applicable_visit_package_for_booking"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_applicable_visit_package_for_booking"("p_booking_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_business_finance_stats"("p_biz_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_branch_id" "uuid", "p_include_open" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_business_finance_stats"("p_biz_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_branch_id" "uuid", "p_include_open" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_business_finance_stats"("p_biz_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_branch_id" "uuid", "p_include_open" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_client_visit_count"("p_client_id" "uuid", "p_branch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_visit_count"("p_client_id" "uuid", "p_branch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_visit_count"("p_client_id" "uuid", "p_branch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_failed_api_requests"("p_endpoint" "text", "p_window_minutes" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_failed_api_requests"("p_endpoint" "text", "p_window_minutes" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_failed_api_requests"("p_endpoint" "text", "p_window_minutes" integer, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_free_slots_complex_day_v1"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_day" "date", "p_duration_min" integer, "p_step_min" integer, "p_per_staff" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_free_slots_complex_day_v1"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_day" "date", "p_duration_min" integer, "p_step_min" integer, "p_per_staff" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_free_slots_complex_day_v1"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_day" "date", "p_duration_min" integer, "p_step_min" integer, "p_per_staff" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_free_slots_service_day"("p_biz_id" "uuid", "p_service_id" "uuid", "p_day" "date", "p_per_staff" integer, "p_step_min" integer, "p_tz" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_free_slots_service_day"("p_biz_id" "uuid", "p_service_id" "uuid", "p_day" "date", "p_per_staff" integer, "p_step_min" integer, "p_tz" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_free_slots_service_day"("p_biz_id" "uuid", "p_service_id" "uuid", "p_day" "date", "p_per_staff" integer, "p_step_min" integer, "p_tz" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_free_slots_service_day_v2"("p_biz_id" "uuid", "p_service_id" "uuid", "p_day" "date", "p_per_staff" integer, "p_step_min" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_free_slots_service_day_v2"("p_biz_id" "uuid", "p_service_id" "uuid", "p_day" "date", "p_per_staff" integer, "p_step_min" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_free_slots_service_day_v2"("p_biz_id" "uuid", "p_service_id" "uuid", "p_day" "date", "p_per_staff" integer, "p_step_min" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_notification_emails"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_notification_emails"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_notification_emails"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_notification_emails"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_slow_api_requests"("p_endpoint" "text", "p_threshold_ms" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_slow_api_requests"("p_endpoint" "text", "p_threshold_ms" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_slow_api_requests"("p_endpoint" "text", "p_threshold_ms" integer, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_staff_finance_stats"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_include_open" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_finance_stats"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_include_open" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_finance_stats"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_date_from" "date", "p_date_to" "date", "p_include_open" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "postgres";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "anon";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_branch_admin"("p_branch_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_branch_admin"("p_branch_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_branch_admin"("p_branch_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."grant_role"("p_user_id" "uuid", "p_role_key" "text", "p_biz_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."grant_role"("p_user_id" "uuid", "p_role_key" "text", "p_biz_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_role"("p_user_id" "uuid", "p_role_key" "text", "p_biz_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_role"("p_user_id" "uuid", "p_role_key" "text", "p_biz_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_role"("p_user" "uuid", "p_biz" "uuid", "p_role_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_role"("p_user" "uuid", "p_biz" "uuid", "p_role_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_role"("p_user" "uuid", "p_biz" "uuid", "p_role_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_role_rpc"("p_user" "uuid", "p_biz" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_role_rpc"("p_user" "uuid", "p_biz" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_role_rpc"("p_user" "uuid", "p_biz" "uuid", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_user_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_user_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_user_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_last_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_last_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_last_super_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_legacy_staff_schedule_write"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_legacy_staff_schedule_write"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_staff_absence_booking"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_staff_absence_booking"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_staff_home_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_staff_home_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_branch_admin"("p_branch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_branch_admin"("p_branch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_branch_admin"("p_branch_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_role"("p_role_key" "text", "p_biz_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_role"("p_role_key" "text", "p_biz_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("p_role_key" "text", "p_biz_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("p_role_key" "text", "p_biz_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("p_biz_id" "uuid", "p_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("p_biz_id" "uuid", "p_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("p_biz_id" "uuid", "p_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hold_complex_slot"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."hold_complex_slot"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hold_complex_slot"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."hold_complex_slot_guest"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb", "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hold_complex_slot_guest"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb", "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hold_complex_slot_guest"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_services" "jsonb", "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hold_slot"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."hold_slot"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hold_slot"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."hold_slot_guest"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hold_slot_guest"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hold_slot_guest"("p_biz_id" "uuid", "p_branch_id" "uuid", "p_service_id" "uuid", "p_staff_id" "uuid", "p_start" timestamp with time zone, "p_client_name" "text", "p_client_phone" "text", "p_client_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_all_ratings"("p_days_back" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_all_ratings"("p_days_back" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_all_ratings"("p_days_back" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_shift_aggregates"("p_staff_id" "uuid", "p_biz_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_shift_aggregates"("p_staff_id" "uuid", "p_biz_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_shift_aggregates"("p_staff_id" "uuid", "p_biz_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "postgres";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "anon";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_api_metric"("p_endpoint" "text", "p_method" "text", "p_status_code" integer, "p_duration_ms" integer, "p_user_id" "uuid", "p_staff_id" "uuid", "p_biz_id" "uuid", "p_error_message" "text", "p_error_type" "text", "p_request_size_bytes" integer, "p_response_size_bytes" integer, "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_api_metric"("p_endpoint" "text", "p_method" "text", "p_status_code" integer, "p_duration_ms" integer, "p_user_id" "uuid", "p_staff_id" "uuid", "p_biz_id" "uuid", "p_error_message" "text", "p_error_type" "text", "p_request_size_bytes" integer, "p_response_size_bytes" integer, "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_api_metric"("p_endpoint" "text", "p_method" "text", "p_status_code" integer, "p_duration_ms" integer, "p_user_id" "uuid", "p_staff_id" "uuid", "p_biz_id" "uuid", "p_error_message" "text", "p_error_type" "text", "p_request_size_bytes" integer, "p_response_size_bytes" integer, "p_metadata" "jsonb", "p_ip_address" "inet", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_booking_analytics_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_booking_analytics_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_booking_analytics_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_finance_operation"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_operation_type" "text", "p_message" "text", "p_log_level" "text", "p_shift_id" "uuid", "p_shift_date" "date", "p_metadata" "jsonb", "p_before_data" "jsonb", "p_after_data" "jsonb", "p_error_message" "text", "p_error_stack" "text", "p_ip_address" "inet", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_finance_operation"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_operation_type" "text", "p_message" "text", "p_log_level" "text", "p_shift_id" "uuid", "p_shift_date" "date", "p_metadata" "jsonb", "p_before_data" "jsonb", "p_after_data" "jsonb", "p_error_message" "text", "p_error_stack" "text", "p_ip_address" "inet", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_finance_operation"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_operation_type" "text", "p_message" "text", "p_log_level" "text", "p_shift_id" "uuid", "p_shift_date" "date", "p_metadata" "jsonb", "p_before_data" "jsonb", "p_after_data" "jsonb", "p_error_message" "text", "p_error_stack" "text", "p_ip_address" "inet", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_frontend_metric"("p_metric_type" "text", "p_metric_data" "jsonb", "p_timestamp" timestamp with time zone, "p_user_id" "uuid", "p_page" "text", "p_user_agent" "text", "p_ip_address" "inet") TO "anon";
GRANT ALL ON FUNCTION "public"."log_frontend_metric"("p_metric_type" "text", "p_metric_data" "jsonb", "p_timestamp" timestamp with time zone, "p_user_id" "uuid", "p_page" "text", "p_user_agent" "text", "p_ip_address" "inet") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_frontend_metric"("p_metric_type" "text", "p_metric_data" "jsonb", "p_timestamp" timestamp with time zone, "p_user_id" "uuid", "p_page" "text", "p_user_agent" "text", "p_ip_address" "inet") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_shift_close_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_shift_close_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_shift_close_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_shift_items_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_shift_items_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_shift_items_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_shift_open_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_shift_open_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_shift_open_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "postgres";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "anon";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "service_role";



GRANT ALL ON FUNCTION "public"."members_of_biz"("p_biz_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."members_of_biz"("p_biz_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."members_of_biz"("p_biz_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."my_role_keys"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."my_role_keys"() TO "anon";
GRANT ALL ON FUNCTION "public"."my_role_keys"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_role_keys"() TO "service_role";



GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "service_role";



GRANT ALL ON FUNCTION "public"."open_staff_shift_safe"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_branch_id" "uuid", "p_shift_date" "date", "p_opened_at" timestamp with time zone, "p_expected_start" timestamp with time zone, "p_late_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."open_staff_shift_safe"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_branch_id" "uuid", "p_shift_date" "date", "p_opened_at" timestamp with time zone, "p_expected_start" timestamp with time zone, "p_late_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."open_staff_shift_safe"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_branch_id" "uuid", "p_shift_date" "date", "p_opened_at" timestamp with time zone, "p_expected_start" timestamp with time zone, "p_late_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_application_for_existing_business"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_application_for_existing_business"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_application_for_existing_business"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_owner_suspended"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_owner_suspended"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_owner_suspended"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_roles_for_suspended"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_roles_for_suspended"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_roles_for_suspended"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."publish_staff_schedule"("p_staff" "uuid", "p_biz" "uuid", "p_actor" "uuid", "p_expected_revision" bigint, "p_kind" "text", "p_from" "date", "p_branch" "uuid", "p_days" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_staff_schedule"("p_staff" "uuid", "p_biz" "uuid", "p_actor" "uuid", "p_expected_revision" bigint, "p_kind" "text", "p_from" "date", "p_branch" "uuid", "p_days" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_expired_holds"() TO "anon";
GRANT ALL ON FUNCTION "public"."purge_expired_holds"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_expired_holds"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."purge_user"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_user"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."purge_user"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_user"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."read_staff_schedule"("p_staff" "uuid", "p_biz" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."read_staff_schedule"("p_staff" "uuid", "p_biz" "uuid", "p_from" "date", "p_to" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."read_staff_schedule_draft"("p_staff" "uuid", "p_biz" "uuid", "p_day" "date", "p_kind" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."read_staff_schedule_draft"("p_staff" "uuid", "p_biz" "uuid", "p_day" "date", "p_kind" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."read_staff_work_locations"("p_biz" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."read_staff_work_locations"("p_biz" "uuid", "p_from" "date", "p_to" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_ratings_for_date"("p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_ratings_for_date"("p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_ratings_for_date"("p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_ratings_for_date_range"("p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_ratings_for_date_range"("p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_ratings_for_date_range"("p_start_date" "date", "p_end_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reject_application_with_policy"("p_application_kind" "text", "p_application_id" "uuid", "p_reviewer_user_id" "uuid", "p_reason" "text", "p_block_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_application_with_policy"("p_application_kind" "text", "p_application_id" "uuid", "p_reviewer_user_id" "uuid", "p_reason" "text", "p_block_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."release_application_submission_block"("p_block_id" "uuid", "p_application_id" "uuid", "p_reviewer_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_application_submission_block"("p_block_id" "uuid", "p_application_id" "uuid", "p_reviewer_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_user_notification_email_source"("target_user_id" "uuid", "target_source" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_user_notification_email_source"("target_user_id" "uuid", "target_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_user_notification_email_source"("target_user_id" "uuid", "target_source" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_user_notification_email_source"("target_user_id" "uuid", "target_source" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."replace_branch_schedule"("p_biz" "uuid", "p_branch" "uuid", "p_actor" "uuid", "p_days" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."replace_branch_schedule"("p_biz" "uuid", "p_branch" "uuid", "p_actor" "uuid", "p_days" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_staff_schedule_day"("p_staff" "uuid", "p_biz" "uuid", "p_actor" "uuid", "p_expected_revision" bigint, "p_day" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_staff_schedule_day"("p_staff" "uuid", "p_biz" "uuid", "p_actor" "uuid", "p_expected_revision" bigint, "p_day" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_staff_day"("p_staff_id" "uuid", "p_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_staff_day"("p_staff_id" "uuid", "p_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_staff_day_legacy"("p_staff_id" "uuid", "p_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_staff_day_legacy"("p_staff_id" "uuid", "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."reviews_set_client_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."reviews_set_client_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reviews_set_client_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_branch_admin"("p_branch_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_branch_admin"("p_branch_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_branch_admin"("p_branch_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revoke_role"("p_user_id" "uuid", "p_role_key" "text", "p_biz_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revoke_role"("p_user_id" "uuid", "p_role_key" "text", "p_biz_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_role"("p_user_id" "uuid", "p_role_key" "text", "p_biz_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_role"("p_user_id" "uuid", "p_role_key" "text", "p_biz_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_role"("p_user" "uuid", "p_biz" "uuid", "p_role_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_role"("p_user" "uuid", "p_biz" "uuid", "p_role_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_role"("p_user" "uuid", "p_biz" "uuid", "p_role_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_role_rpc"("p_user" "uuid", "p_biz" "uuid", "p_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_role_rpc"("p_user" "uuid", "p_biz" "uuid", "p_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_role_rpc"("p_user" "uuid", "p_biz" "uuid", "p_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_user_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_user_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_user_role"("p_user_id" "uuid", "p_biz_id" "uuid", "p_role_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."role_id"("p_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."role_id"("p_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."role_id"("p_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rule_branch_is_not_home"("p_staff_id" "uuid", "p_branch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rule_branch_is_not_home"("p_staff_id" "uuid", "p_branch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rule_branch_is_not_home"("p_staff_id" "uuid", "p_branch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."save_shift_items_atomic"("p_shift_id" "uuid", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_shift_items_atomic"("p_shift_id" "uuid", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_shift_items_atomic"("p_shift_id" "uuid", "p_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."schedule_actor_can_manage"("p_actor" "uuid", "p_biz" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."schedule_actor_can_manage"("p_actor" "uuid", "p_biz" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."schedule_bound_to_branch"("p_day" "jsonb", "p_biz" "uuid", "p_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."schedule_bound_to_branch"("p_day" "jsonb", "p_biz" "uuid", "p_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."schedule_contains_booking"("p_staff" "uuid", "p_branch" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."schedule_contains_booking"("p_staff" "uuid", "p_branch" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."schedule_effective_day"("p_staff" "uuid", "p_day" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."schedule_effective_day"("p_staff" "uuid", "p_day" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."schedule_validate_day"("p_day" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."schedule_validate_day"("p_day" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_my_notification_email_preferences"("target_enabled" boolean, "target_emails" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_my_notification_email_preferences"("target_enabled" boolean, "target_emails" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."set_my_notification_email_preferences"("target_enabled" boolean, "target_emails" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_my_notification_email_preferences"("target_enabled" boolean, "target_emails" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_timestamp_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_timestamp_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_timestamp_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "anon";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_auth_user_notification_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_auth_user_notification_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_auth_user_notification_email"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_user_notification_email"("target_user_id" "uuid", "target_email" "text", "target_source" "text", "target_provider_subject" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_user_notification_email"("target_user_id" "uuid", "target_email" "text", "target_source" "text", "target_provider_subject" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_notification_email"("target_user_id" "uuid", "target_email" "text", "target_source" "text", "target_provider_subject" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_notification_email"("target_user_id" "uuid", "target_email" "text", "target_source" "text", "target_provider_subject" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."transfer_staff_home"("p_staff" "uuid", "p_biz" "uuid", "p_actor" "uuid", "p_expected_branch" "uuid", "p_target" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transfer_staff_home"("p_staff" "uuid", "p_biz" "uuid", "p_actor" "uuid", "p_expected_branch" "uuid", "p_target" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."transition_telegram_profile_link"("p_hash" "text", "p_action" "text", "p_owner" "uuid", "p_telegram" bigint, "p_username" "text", "p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_telegram_profile_link"("p_hash" "text", "p_action" "text", "p_owner" "uuid", "p_telegram" bigint, "p_username" "text", "p_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."transition_telegram_web_login"("p_hash" "text", "p_action" "text", "p_browser" "text", "p_telegram" bigint, "p_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."transition_telegram_web_login"("p_hash" "text", "p_action" "text", "p_browser" "text", "p_telegram" bigint, "p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."unlink_auth_identity"("target_user_id" "uuid", "target_provider" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unlink_auth_identity"("target_user_id" "uuid", "target_provider" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_all_aggregated_ratings"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_all_aggregated_ratings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_all_aggregated_ratings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_booking_status_no_check"("p_booking_id" "uuid", "p_new_status" "public"."booking_status") TO "anon";
GRANT ALL ON FUNCTION "public"."update_booking_status_no_check"("p_booking_id" "uuid", "p_new_status" "public"."booking_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_booking_status_no_check"("p_booking_id" "uuid", "p_new_status" "public"."booking_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_booking_status_with_promotion"("p_booking_id" "uuid", "p_new_status" "public"."booking_status") TO "anon";
GRANT ALL ON FUNCTION "public"."update_booking_status_with_promotion"("p_booking_id" "uuid", "p_new_status" "public"."booking_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_booking_status_with_promotion"("p_booking_id" "uuid", "p_new_status" "public"."booking_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_shift_aggregates"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_shift_date" "date", "p_total_amount" numeric, "p_master_share" numeric, "p_salon_share" numeric, "p_late_minutes" integer, "p_guaranteed_amount" numeric, "p_topup_amount" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."update_shift_aggregates"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_shift_date" "date", "p_total_amount" numeric, "p_master_share" numeric, "p_salon_share" numeric, "p_late_minutes" integer, "p_guaranteed_amount" numeric, "p_topup_amount" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_shift_aggregates"("p_staff_id" "uuid", "p_biz_id" "uuid", "p_shift_date" "date", "p_total_amount" numeric, "p_master_share" numeric, "p_salon_share" numeric, "p_late_minutes" integer, "p_guaranteed_amount" numeric, "p_topup_amount" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."user_current_business_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_current_business_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_current_business_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "service_role";















GRANT ALL ON TABLE "public"."account_deletion_requests" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."api_request_metrics" TO "anon";
GRANT ALL ON TABLE "public"."api_request_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."api_request_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."application_moderation_actions" TO "service_role";



GRANT ALL ON TABLE "public"."application_submission_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."user_suspensions" TO "anon";
GRANT ALL ON TABLE "public"."user_suspensions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_suspensions" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."auth_users_view" TO "anon";
GRANT ALL ON TABLE "public"."auth_users_view" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_users_view" TO "service_role";



GRANT ALL ON TABLE "public"."biz_day_metrics" TO "anon";
GRANT ALL ON TABLE "public"."biz_day_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."biz_day_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."booking_services" TO "anon";
GRANT ALL ON TABLE "public"."booking_services" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_services" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."branch_admins" TO "anon";
GRANT ALL ON TABLE "public"."branch_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."branch_admins" TO "service_role";



GRANT ALL ON TABLE "public"."branch_day_metrics" TO "anon";
GRANT ALL ON TABLE "public"."branch_day_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."branch_day_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."branch_promotions" TO "anon";
GRANT ALL ON TABLE "public"."branch_promotions" TO "authenticated";
GRANT ALL ON TABLE "public"."branch_promotions" TO "service_role";



GRANT ALL ON TABLE "public"."branch_working_hours" TO "anon";
GRANT ALL ON TABLE "public"."branch_working_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."branch_working_hours" TO "service_role";



GRANT ALL ON TABLE "public"."branches" TO "anon";
GRANT ALL ON TABLE "public"."branches" TO "authenticated";
GRANT ALL ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON TABLE "public"."business_creation_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."business_daily_stats" TO "anon";
GRANT ALL ON TABLE "public"."business_daily_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."business_daily_stats" TO "service_role";



GRANT ALL ON TABLE "public"."business_hourly_load" TO "anon";
GRANT ALL ON TABLE "public"."business_hourly_load" TO "authenticated";
GRANT ALL ON TABLE "public"."business_hourly_load" TO "service_role";



GRANT ALL ON TABLE "public"."business_registration_applications" TO "service_role";



GRANT ALL ON TABLE "public"."business_role_applications" TO "service_role";



GRANT ALL ON TABLE "public"."businesses" TO "anon";
GRANT ALL ON TABLE "public"."businesses" TO "authenticated";
GRANT ALL ON TABLE "public"."businesses" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."client_promotion_usage" TO "anon";
GRANT ALL ON TABLE "public"."client_promotion_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."client_promotion_usage" TO "service_role";



GRANT ALL ON TABLE "public"."client_referrals" TO "anon";
GRANT ALL ON TABLE "public"."client_referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."client_referrals" TO "service_role";



GRANT ALL ON TABLE "public"."client_visit_package_uses" TO "anon";
GRANT ALL ON TABLE "public"."client_visit_package_uses" TO "authenticated";
GRANT ALL ON TABLE "public"."client_visit_package_uses" TO "service_role";



GRANT ALL ON TABLE "public"."client_visit_packages" TO "anon";
GRANT ALL ON TABLE "public"."client_visit_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."client_visit_packages" TO "service_role";



GRANT ALL ON TABLE "public"."staff_branch_assignments" TO "anon";
GRANT ALL ON TABLE "public"."staff_branch_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_branch_assignments" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."current_staff_branch" TO "anon";
GRANT ALL ON TABLE "public"."current_staff_branch" TO "authenticated";
GRANT ALL ON TABLE "public"."current_staff_branch" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."current_user_roles" TO "anon";
GRANT ALL ON TABLE "public"."current_user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."current_user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."finance_settings_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."finance_settings_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_settings_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."frontend_metrics" TO "anon";
GRANT ALL ON TABLE "public"."frontend_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."frontend_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."funnel_events" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rating_biz_config" TO "anon";
GRANT ALL ON TABLE "public"."rating_biz_config" TO "authenticated";
GRANT ALL ON TABLE "public"."rating_biz_config" TO "service_role";



GRANT ALL ON TABLE "public"."rating_global_config" TO "anon";
GRANT ALL ON TABLE "public"."rating_global_config" TO "authenticated";
GRANT ALL ON TABLE "public"."rating_global_config" TO "service_role";



GRANT ALL ON TABLE "public"."rating_jobs" TO "anon";
GRANT ALL ON TABLE "public"."rating_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."rating_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."rating_manual_recalc_log" TO "anon";
GRANT ALL ON TABLE "public"."rating_manual_recalc_log" TO "authenticated";
GRANT ALL ON TABLE "public"."rating_manual_recalc_log" TO "service_role";



GRANT ALL ON TABLE "public"."rating_recalc_errors" TO "anon";
GRANT ALL ON TABLE "public"."rating_recalc_errors" TO "authenticated";
GRANT ALL ON TABLE "public"."rating_recalc_errors" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."service_staff" TO "anon";
GRANT ALL ON TABLE "public"."service_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."service_staff" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."staff" TO "anon";
GRANT ALL ON TABLE "public"."staff" TO "authenticated";
GRANT ALL ON TABLE "public"."staff" TO "service_role";



GRANT ALL ON TABLE "public"."staff_day_metrics" TO "anon";
GRANT ALL ON TABLE "public"."staff_day_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_day_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."staff_finance_operation_logs" TO "anon";
GRANT ALL ON TABLE "public"."staff_finance_operation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_finance_operation_logs" TO "service_role";



GRANT SELECT ON TABLE "public"."staff_home_branch_changes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."staff_home_branch_changes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."staff_home_branch_changes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."staff_home_branch_changes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."staff_schedule_rules" TO "anon";
GRANT ALL ON TABLE "public"."staff_schedule_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_schedule_rules" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."staff_schedule_versions" TO "service_role";



GRANT ALL ON TABLE "public"."staff_shift_aggregates" TO "anon";
GRANT ALL ON TABLE "public"."staff_shift_aggregates" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_shift_aggregates" TO "service_role";



GRANT ALL ON TABLE "public"."staff_shift_expenses" TO "anon";
GRANT ALL ON TABLE "public"."staff_shift_expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_shift_expenses" TO "service_role";



GRANT ALL ON TABLE "public"."staff_shift_items" TO "anon";
GRANT ALL ON TABLE "public"."staff_shift_items" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_shift_items" TO "service_role";



GRANT ALL ON TABLE "public"."staff_shifts" TO "anon";
GRANT ALL ON TABLE "public"."staff_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_shifts" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_time_off" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."staff_time_off" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_time_off" TO "service_role";



GRANT ALL ON TABLE "public"."super_admins_legacy" TO "anon";
GRANT ALL ON TABLE "public"."super_admins_legacy" TO "authenticated";
GRANT ALL ON TABLE "public"."super_admins_legacy" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_auth_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."telegram_auth_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_auth_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_mobile_auth_attempts" TO "anon";
GRANT ALL ON TABLE "public"."telegram_mobile_auth_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_mobile_auth_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_profile_link_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_web_login_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."user_current_business" TO "anon";
GRANT ALL ON TABLE "public"."user_current_business" TO "authenticated";
GRANT ALL ON TABLE "public"."user_current_business" TO "service_role";



GRANT ALL ON TABLE "public"."user_global_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_global_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_global_roles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_notification_email_sources" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_notification_email_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notification_email_sources" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_notification_emails" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_notification_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notification_emails" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."user_roles_legacy" TO "anon";
GRANT ALL ON TABLE "public"."user_roles_legacy" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles_legacy" TO "service_role";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."user_roles_with_user" TO "anon";
GRANT ALL ON TABLE "public"."user_roles_with_user" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles_with_user" TO "service_role";



GRANT ALL ON TABLE "public"."visit_package_plans" TO "anon";
GRANT ALL ON TABLE "public"."visit_package_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."visit_package_plans" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_messages" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_messages" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_otp_codes" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_otp_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_otp_codes" TO "service_role";



GRANT ALL ON TABLE "public"."working_hours" TO "anon";
GRANT ALL ON TABLE "public"."working_hours" TO "authenticated";
GRANT ALL ON TABLE "public"."working_hours" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
