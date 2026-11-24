-- Staff invitations follow the card (review of API-06, 20261120090000).
--
-- 1. Accepting while the person already has a card in the business used to raise and leave the
--    invitation pending: it stayed in their cabinet and answered 409 on every try. It is now
--    cancelled, and the result says why.
-- 2. A card linked to an account by any path (an approved staff application, an accepted
--    invitation, the service role) cancels that person's other pending invitations in the same
--    business, so none of them is left to accept.
-- 3. A card that stops being active (a dismissal) cancels its pending invitation: accepting it
--    would link the person to a card the business has let go.
-- 4. Accept returns whether the card is active. A card created inactive can still be accepted, but
--    the staff role and cabinet follow only once the business activates it, and the cabinet must
--    not promise more.
begin;

create schema if not exists private;
revoke all on schema private from public;

create or replace function public.accept_staff_invitation(p_invitation_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
    v_invitation public.staff_invitations%rowtype;
    v_staff public.staff%rowtype;
begin
    select * into v_invitation
      from public.staff_invitations
     where id = p_invitation_id
     for update;
    if not found or p_user_id is null or v_invitation.invited_user_id <> p_user_id then
        raise exception using errcode = 'P0001', message = 'STAFF_INVITATION_NOT_FOUND';
    end if;
    if v_invitation.status <> 'pending' then
        raise exception using errcode = 'P0001', message = 'STAFF_INVITATION_NOT_PENDING';
    end if;

    select * into v_staff
      from public.staff
     where id = v_invitation.staff_id
     for update;
    if not found or v_staff.biz_id <> v_invitation.biz_id or v_staff.user_id is not null then
        update public.staff_invitations
           set status = 'cancelled', decided_at = now()
         where id = v_invitation.id;
        return jsonb_build_object('status', 'stale', 'error', 'STAFF_INVITATION_STALE');
    end if;

    -- Already in the team by another card: this invitation can never be accepted.
    if exists (
        select 1 from public.staff s
         where s.biz_id = v_invitation.biz_id
           and s.user_id = p_user_id
    ) then
        update public.staff_invitations
           set status = 'cancelled', decided_at = now()
         where id = v_invitation.id;
        return jsonb_build_object('status', 'stale', 'error', 'STAFF_INVITATION_ALREADY_STAFF');
    end if;

    begin
        update public.staff
           set user_id = p_user_id
         where id = v_staff.id;
    exception when unique_violation then
        -- A concurrent link of this person in the business won the race.
        update public.staff_invitations
           set status = 'cancelled', decided_at = now()
         where id = v_invitation.id;
        return jsonb_build_object('status', 'stale', 'error', 'STAFF_INVITATION_ALREADY_STAFF');
    end;

    update public.staff_invitations
       set status = 'accepted', decided_at = now()
     where id = v_invitation.id;

    return jsonb_build_object(
        'status', 'accepted',
        'staff_id', v_staff.id,
        'biz_id', v_invitation.biz_id,
        'is_active', coalesce(v_staff.is_active, false)
    );
end;
$$;

revoke all on function public.accept_staff_invitation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_staff_invitation(uuid, uuid) to service_role;

-- Owner-run (security definer): staff_invitations is service role only, while a manager's own
-- session may also dismiss a card through the staff guard.
create or replace function private.cancel_superseded_staff_invitations()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
    if new.user_id is not null and (tg_op = 'INSERT' or old.user_id is distinct from new.user_id) then
        update public.staff_invitations
           set status = 'cancelled', decided_at = now()
         where biz_id = new.biz_id
           and invited_user_id = new.user_id
           and status = 'pending'
           and staff_id <> new.id;
    end if;

    if tg_op = 'UPDATE' and coalesce(old.is_active, false) and not coalesce(new.is_active, false) then
        update public.staff_invitations
           set status = 'cancelled', decided_at = now()
         where staff_id = new.id
           and status = 'pending';
    end if;

    return null;
end;
$$;

revoke all on function private.cancel_superseded_staff_invitations() from public, anon, authenticated;

drop trigger if exists staff_cancel_superseded_invitations on public.staff;
create trigger staff_cancel_superseded_invitations
    after insert or update of user_id, is_active on public.staff
    for each row execute function private.cancel_superseded_staff_invitations();

commit;
