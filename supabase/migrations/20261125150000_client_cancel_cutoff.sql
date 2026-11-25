-- R25-10 (docs/PROJECT_REVIEW_2026-11-25.md): a client could cancel a booking that had already
-- started or ended, in the app and on the web; the business then could no longer mark the visit as
-- a no-show or paid. Owner decision of 25 Nov 2026: the client cancels only before the start
-- (start_at > now()). From the start on, only the business changes the booking: the owner, a
-- business manager (finance_can_manage_business), the branch admin, a super admin or the booking's
-- own active staff member, exactly the callers _assert_booking_transition_access admits besides the
-- client. A client who is also one of those keeps the business's rights. Calls without a JWT
-- (service role, trusted SQL) are unchanged.
--
-- cancel_booking is the definition from 20261110123000 with one added check after the status
-- checks, so a cancelled, paid or benefit booking answers as before. The check runs on the row
-- locked by _assert_booking_transition_access, so a start passing during the call cannot slip by.
-- New error: BOOKING_ALREADY_STARTED (P0001), answered by the routes with 409.
begin;

create or replace function public.cancel_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp set lock_timeout='5s' as $$
declare
  v_booking public.bookings;
  v_actor uuid := auth.uid();
begin
  v_booking := public._assert_booking_transition_access(p_booking_id);
  if v_booking.status='cancelled' then return; end if;
  if v_booking.status='paid' or v_booking.promotion_applied is not null
    or v_booking.subscription_applied is not null
    or exists(select 1 from public.staff_shift_items i where i.booking_id=p_booking_id) then
    raise exception using errcode='P0001',message='BOOKING_FINANCIAL_REVERSAL_REQUIRED';
  end if;
  if v_booking.status not in ('hold','confirmed') then
    raise exception using errcode='P0001',message='BOOKING_STATUS_NOT_CANCELLABLE';
  end if;
  -- R25-10: the client's own cancellation ends at the start of the visit.
  if v_actor is not null and v_booking.client_id = v_actor and v_booking.start_at <= now() then
    if not public.finance_can_manage_business(v_actor,v_booking.biz_id)
      and not public.has_branch_admin(v_booking.branch_id)
      and not public.is_super_admin()
      and not exists(select 1 from public.staff s where s.id=v_booking.staff_id
        and s.biz_id=v_booking.biz_id and s.user_id=v_actor and s.is_active) then
      raise exception using errcode='P0001',message='BOOKING_ALREADY_STARTED';
    end if;
  end if;
  update public.bookings set status='cancelled',expires_at=null where id=p_booking_id;
end;
$$;
revoke all on function public.cancel_booking(uuid) from public,anon;
grant execute on function public.cancel_booking(uuid) to authenticated,service_role;

commit;
