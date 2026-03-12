-- Создаём RPC get_free_slots_complex_day_v1 для расчёта свободных слотов
-- под комплекс услуг заданной суммарной длительности.
--
-- Входные параметры:
--   p_biz_id      - бизнес
--   p_branch_id   - целевой филиал (может быть NULL, тогда берётся branch_id из расписания мастера)
--   p_staff_id    - мастер (может быть NULL, тогда считаем для всех активных мастеров бизнеса)
--   p_day         - дата в локальном времени бизнеса
--   p_duration_min - суммарная длительность комплекса услуг в минутах
--   p_step_min    - шаг генерации слотов (минуты)
--
-- Возврат:
--   staff_id, branch_id, start_at, end_at — как в get_free_slots_service_day_v2.

create or replace function public.get_free_slots_complex_day_v1(
    p_biz_id uuid,
    p_branch_id uuid,
    p_staff_id uuid,
    p_day date,
    p_duration_min integer,
    p_step_min integer default 15,
    p_per_staff integer default 200
)
returns table(
    staff_id uuid,
    branch_id uuid,
    start_at timestamp with time zone,
    end_at timestamp with time zone
)
language plpgsql
as $function$
declare
    v_staff record;
    v_sched record;
    v_biz_tz text;
    v_effective_branch_id uuid;
begin
    if p_duration_min is null or p_duration_min <= 0 then
        raise exception 'INVALID_DURATION_MIN';
    end if;

    -- Читаем таймзону бизнеса
    select b.tz
    into v_biz_tz
    from public.businesses b
    where b.id = p_biz_id;

    if v_biz_tz is null then
        v_biz_tz := 'Asia/Bishkek';
    end if;

    -- Перебираем активных сотрудников бизнеса (либо одного, если p_staff_id задан)
    for v_staff in
        select st.id as staff_id, st.branch_id as home_branch_id
        from public.staff st
        where st.biz_id = p_biz_id
          and st.is_active
          and (p_staff_id is null or st.id = p_staff_id)
    loop
        -- Получаем расписание на дату (resolve_staff_day уже учитывает временные переводы)
        select *
        into v_sched
        from public.resolve_staff_day(v_staff.staff_id, p_day);

        if not found then
            continue;
        end if;

        -- Проверяем, что в расписании есть интервалы работы
        if v_sched.intervals is null or jsonb_array_length(v_sched.intervals) = 0 then
            continue;
        end if;

        -- Эффективный филиал мастера на эту дату
        v_effective_branch_id := v_sched.branch_id;

        -- Если явно задан p_branch_id, фильтруем по нему
        if p_branch_id is not null and v_effective_branch_id is distinct from p_branch_id then
            continue;
        end if;

        -- Генерируем сетку слотов в локальном времени бизнеса → переводим в timestamptz
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
                from jsonb_array_elements(v_sched.breaks) as j
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
                      and bk.status <> 'cancelled'
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
$function$;

