-- Обновление функции проверки соответствия филиала брони и мастера
-- Раньше функция смотрела только на current_staff_branch (текущий филиал),
-- из‑за чего при бронировании на будущие/прошлые даты могла возникать ошибка
-- "Staff ... is not assigned to branch ... on this date", даже если в истории
-- назначений мастер был прикреплён к филиалу.
--
-- Теперь проверяем по таблице staff_branch_assignments и дате start_at.

create or replace function public.check_booking_branch_match()
returns trigger
language plpgsql
as $$
declare
    v_date date;
    v_exists boolean;
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
    into v_exists;

    if not v_exists then
        raise exception
            'Staff % is not assigned to branch % on date %',
            NEW.staff_id, NEW.branch_id, v_date
            using errcode = '22023';
    end if;

    return NEW;
end;
$$;


