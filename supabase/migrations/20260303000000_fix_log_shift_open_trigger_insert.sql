-- Исправление триггера log_shift_open: при INSERT переменная OLD не определена в PostgreSQL,
-- обращение к old.status вызывало ошибку и падение вставки в staff_shifts (ошибка "Не удалось создать смену").

create or replace function public.log_shift_open_trigger()
returns trigger
language plpgsql
as $$
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

comment on function public.log_shift_open_trigger is 'Автоматически логирует открытие смены (INSERT или смена статуса на open).';
