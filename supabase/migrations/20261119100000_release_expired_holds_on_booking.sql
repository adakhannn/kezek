-- An expired hold no longer blocks its time (17 Nov review, docs/ENGINEERING_FINDINGS.md ENG-121).
--
-- A hold is a reservation of a few minutes. The slot readers (get_free_slots_service_day_v2 and the
-- complex-day slots) and the writers' own checks treat a hold as taken only while expires_at > now(),
-- but the no_overlap exclusion constraint on bookings counts every row in status hold, confirmed or
-- paid. An expired hold therefore stayed in the constraint until purge_expired_holds (pg_cron, every
-- minute) cancelled it: for up to about a minute the public form showed the slot as free and the
-- booking failed with 23P01 (409 booking_slot_unavailable).
--
-- Before a booking takes a time (insert, or an update to an active status, another time or another
-- staff member), this trigger cancels the expired holds of the same staff member overlapping that
-- time, exactly as purge_expired_holds would: status cancelled, expires_at null, the same notification
-- and analytics triggers. Holds without expires_at are left alone, as the purge leaves them. Holds
-- locked by another transaction (for example the purge itself) are skipped; the constraint then waits
-- for that transaction as before. If cancelling fails, the booking proceeds as before and the
-- constraint decides. The trigger is named to run after check_explicit_schedule_booking, which takes
-- the staff row lock that serializes bookings of one staff member.

create or replace function private.release_expired_overlapping_holds()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    if new.status not in ('hold', 'confirmed', 'paid') then
        return new;
    end if;
    -- An active booking keeping its staff member and time cannot meet a new conflict.
    if tg_op = 'UPDATE'
        and old.status in ('hold', 'confirmed', 'paid')
        and new.staff_id is not distinct from old.staff_id
        and new.start_at is not distinct from old.start_at
        and new.end_at is not distinct from old.end_at then
        return new;
    end if;
    if not exists (
        select 1
          from public.bookings b
         where b.staff_id = new.staff_id
           and b.status = 'hold'
           and b.expires_at <= now()
           and b.id is distinct from new.id
           and b.time_range && tstzrange(new.start_at, new.end_at, '[)')
    ) then
        return new;
    end if;
    begin
        update public.bookings
           set status = 'cancelled', expires_at = null
         where id in (
            select b.id
              from public.bookings b
             where b.staff_id = new.staff_id
               and b.status = 'hold'
               and b.expires_at <= now()
               and b.id is distinct from new.id
               and b.time_range && tstzrange(new.start_at, new.end_at, '[)')
               for update skip locked
         );
    exception when others then
        raise warning 'expired holds overlapping booking % were not released: %', new.id, sqlerrm;
    end;
    return new;
end;
$$;

-- A trigger function: nobody calls it directly.
revoke all on function private.release_expired_overlapping_holds() from public;

drop trigger if exists release_expired_overlapping_holds on public.bookings;
create trigger release_expired_overlapping_holds
    before insert or update of status, staff_id, start_at, end_at on public.bookings
    for each row execute function private.release_expired_overlapping_holds();
