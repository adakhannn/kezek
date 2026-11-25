-- R25-12: changing businesses.tz silently moved every future booking against the schedule.
-- Schedules are stored as local HH:MM and read in the current business zone, while bookings are
-- instants: a 09:00 booking in Asia/Bishkek became 08:00 and outside working hours after a switch to
-- Asia/Tashkent, unnoticed. Every other schedule writer refuses such conflicts
-- (SCHEDULE_BOOKING_CONFLICT); the zone now does too.
--
-- A change is refused while the business has a confirmed booking or a live hold that has not started.
-- Setting the same effective zone (NULL or blank is Asia/Bishkek) is not a change.

create or replace function private.guard_business_tz_change()
returns trigger language plpgsql security definer set search_path = pg_catalog, public as $$
begin
    if coalesce(nullif(btrim(new.tz), ''), 'Asia/Bishkek') is distinct from coalesce(nullif(btrim(old.tz), ''), 'Asia/Bishkek')
        and exists (
            select 1 from public.bookings b
            where b.biz_id = new.id and b.start_at > statement_timestamp()
              and (b.status = 'confirmed' or (b.status = 'hold' and b.expires_at > statement_timestamp()))
        ) then
        raise exception using errcode = 'P0001', message = 'BUSINESS_TZ_HAS_FUTURE_BOOKINGS';
    end if;
    return new;
end;
$$;

-- Trigger functions need no EXECUTE grant (DB-11); keep it closed.
revoke all on function private.guard_business_tz_change() from public, anon, authenticated;

drop trigger if exists businesses_guard_tz_change on public.businesses;
create trigger businesses_guard_tz_change
    before update of tz on public.businesses
    for each row execute function private.guard_business_tz_change();
