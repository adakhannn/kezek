-- Обновление функции проверки соответствия филиала брони и мастера
-- Теперь проверяем не только staff_branch_assignments, но и staff_schedule_rules
-- для поддержки временных переводов между филиалами через расписание

create or replace function public.check_booking_branch_match()
returns trigger
language plpgsql
as $$
declare
    v_date date;
    v_exists_in_assignments boolean;
    v_exists_in_schedule_rules boolean;
begin
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

