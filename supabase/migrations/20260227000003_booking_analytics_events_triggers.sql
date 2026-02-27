-- Триггеры для логирования доменных событий по бронированиям в analytics_events
--
-- Цели:
-- 1. Логировать создание бронирования (booking_created).
-- 2. Логировать успешный переход бронирования в confirmed/paid (booking_confirmed_or_paid).
-- 3. Не завязываться на конкретный HTTP‑роут или RPC — работать на уровне таблицы bookings.

create or replace function public.log_booking_analytics_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

comment on function public.log_booking_analytics_event is
    'Триггер-функция: логирует события booking_created и booking_confirmed_or_paid в analytics_events.';

drop trigger if exists bookings_analytics_events_insert on public.bookings;
drop trigger if exists bookings_analytics_events_update on public.bookings;

create trigger bookings_analytics_events_insert
after insert on public.bookings
for each row
execute function public.log_booking_analytics_event();

create trigger bookings_analytics_events_update
after update of status on public.bookings
for each row
execute function public.log_booking_analytics_event();

