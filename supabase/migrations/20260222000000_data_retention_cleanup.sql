-- DATA_RETENTION: функции удаления/анонимизации старых данных
-- Сроки и обоснование см. DATA_RETENTION.md

-- 1. Очистка старых событий воронки (funnel_events)
create or replace function public.cleanup_old_funnel_events(
    p_keep_days integer default 400
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_deleted_count integer;
begin
    delete from public.funnel_events
    where created_at < timezone('utc'::text, now()) - (p_keep_days || ' days')::interval;
    get diagnostics v_deleted_count = row_count;
    return v_deleted_count;
end;
$$;

comment on function public.cleanup_old_funnel_events(integer) is 'Удаляет события воронки старше указанного количества дней. По умолчанию 400 дней.';
grant execute on function public.cleanup_old_funnel_events(integer) to service_role;

-- 2. Анонимизация PII в старых бронированиях (bookings)
-- Только записи, у которых start_at старше p_older_than_days
create or replace function public.anonymize_old_bookings_pii(
    p_older_than_days integer default 2555
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
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

comment on function public.anonymize_old_bookings_pii(integer) is 'Анонимизирует client_name, client_phone, client_email в бронях старше указанного количества дней (по умолчанию 7 лет = 2555).';
grant execute on function public.anonymize_old_bookings_pii(integer) to service_role;

-- 3. Анонимизация PII в неактивных профилях (profiles)
-- Профили, которые не являются сотрудниками и не имели броней за последние p_inactive_days
create or replace function public.anonymize_inactive_profiles_pii(
    p_inactive_days integer default 1095
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_updated_count integer;
    v_cutoff timestamptz;
begin
    v_cutoff := timezone('utc'::text, now()) - (p_inactive_days || ' days')::interval;
    with inactive as (
        select p.id
        from public.profiles p
        where (p.full_name is not null or p.phone is not null)
          and p.id not in (select s.user_id from public.staff s where s.user_id is not null)
          and not exists (
              select 1 from public.bookings b
              where b.client_id = p.id and b.start_at >= v_cutoff
          )
    )
    update public.profiles
    set full_name = 'Anonymized', phone = null
    from inactive
    where profiles.id = inactive.id;
    get diagnostics v_updated_count = row_count;
    return v_updated_count;
end;
$$;

comment on function public.anonymize_inactive_profiles_pii(integer) is 'Анонимизирует full_name и phone в профилях, не являющихся сотрудниками и не имевших броней за указанный период (по умолчанию 3 года = 1095 дней).';
grant execute on function public.anonymize_inactive_profiles_pii(integer) to service_role;
