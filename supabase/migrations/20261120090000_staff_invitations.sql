-- A staff card is linked to an account only with that person's consent (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md API-06).
--
-- A manager could link a staff card to anyone's account: POST /api/staff/create-from-user took any
-- user_id, POST /api/staff/create linked the account that confirmed the given e-mail or phone, and a
-- manager's client session could set staff.user_id through PostgREST (staff_guard_client_write let
-- finance_can_manage_business change it). The linked account then got the staff role of the business
-- (staff_ensure_staff_role), a staff cabinet in it and could be locked out of other cabinets.
--
-- Now the application creates the card without an account and invites the person instead:
--   * staff_invitations holds one pending invitation per card and per (business, account); service
--     role only, like every new object (DB-11);
--   * accept_staff_invitation links the card when the invited person accepts, so the existing
--     trigger grants the staff role; a card that was linked in the meantime or moved to another
--     business cancels the invitation; an account that already has a card in the business is
--     refused;
--   * decline_staff_invitation records the refusal; the card stays an unlinked card of the business;
--   * staff_guard_client_write now refuses a client session that sets staff.user_id to an account.
--     Unlinking (user_id = null) stays allowed to managers. The service role and SECURITY DEFINER
--     commands owned by postgres (approve_staff_application, accept_staff_invitation) are not client
--     sessions for the guard (current_user), as before.
-- Re-running changes nothing.

create table if not exists public.staff_invitations (
    id uuid primary key default gen_random_uuid(),
    biz_id uuid not null references public.businesses(id) on delete cascade,
    staff_id uuid not null references public.staff(id) on delete cascade,
    invited_user_id uuid not null references auth.users(id) on delete cascade,
    invited_by uuid references auth.users(id) on delete set null,
    status text not null default 'pending'
        constraint staff_invitations_status_check check (status in ('pending', 'accepted', 'declined', 'cancelled')),
    created_at timestamptz not null default now(),
    decided_at timestamptz
);

comment on table public.staff_invitations is
    'Invitations to link a staff card to an account (API-06). The card is linked only when the invited person accepts.';

-- One pending invitation per card, and per person in a business.
create unique index if not exists staff_invitations_pending_staff_unique
    on public.staff_invitations (staff_id) where status = 'pending';
create unique index if not exists staff_invitations_pending_user_biz_unique
    on public.staff_invitations (biz_id, invited_user_id) where status = 'pending';
create index if not exists staff_invitations_invited_user_idx
    on public.staff_invitations (invited_user_id, status);

alter table public.staff_invitations enable row level security;
revoke all on table public.staff_invitations from public, anon, authenticated;
grant all on table public.staff_invitations to service_role;

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

    -- The card was linked meanwhile or belongs to another business now: the invitation is void. It
    -- is cancelled and the result says so; an exception would roll the cancellation back.
    if not found or v_staff.biz_id <> v_invitation.biz_id or v_staff.user_id is not null then
        update public.staff_invitations
           set status = 'cancelled', decided_at = now()
         where id = v_invitation.id;
        return jsonb_build_object('status', 'stale', 'error', 'STAFF_INVITATION_STALE');
    end if;

    if exists (
        select 1 from public.staff s
         where s.biz_id = v_invitation.biz_id
           and s.user_id = p_user_id
    ) then
        raise exception using errcode = 'P0001', message = 'STAFF_INVITATION_ALREADY_STAFF';
    end if;

    begin
        update public.staff
           set user_id = p_user_id
         where id = v_staff.id;
    exception when unique_violation then
        -- staff_user_business_unique: a concurrent command gave the account a card in this business.
        raise exception using errcode = 'P0001', message = 'STAFF_INVITATION_ALREADY_STAFF';
    end;

    update public.staff_invitations
       set status = 'accepted', decided_at = now()
     where id = v_invitation.id;

    return jsonb_build_object('status', 'accepted', 'staff_id', v_staff.id, 'biz_id', v_invitation.biz_id);
end;
$$;

revoke all on function public.accept_staff_invitation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.accept_staff_invitation(uuid, uuid) to service_role;

create or replace function public.decline_staff_invitation(p_invitation_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
    v_invitation public.staff_invitations%rowtype;
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

    update public.staff_invitations
       set status = 'declined', decided_at = now()
     where id = v_invitation.id;
end;
$$;

revoke all on function public.decline_staff_invitation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.decline_staff_invitation(uuid, uuid) to service_role;

-- The body of 20261117200000_close_client_write_paths with one addition: a client session never sets
-- user_id to an account (API-06). SECURITY INVOKER on purpose: current_user is the client role for
-- PostgREST writes and the function owner inside SECURITY DEFINER commands, which stay unrestricted.
create or replace function public.staff_guard_client_write()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
    if current_user not in ('anon', 'authenticated') then
        return new;
    end if;

    if tg_op = 'INSERT' then
        if new.user_id is not null then
            raise exception 'STAFF_USER_LINK_FORBIDDEN' using errcode = '42501';
        end if;
        if not public.staff_write_allowed(new.biz_id, new.branch_id) then
            raise exception 'STAFF_WRITE_FORBIDDEN' using errcode = '42501';
        end if;
        new.rating_score := null;
        new.rating_updated_at := null;
        new.last_rating_recalculated_at := null;
        return new;
    end if;

    if new.id is distinct from old.id
       or new.biz_id is distinct from old.biz_id
       or new.created_at is distinct from old.created_at
       or new.rating_score is distinct from old.rating_score
       or new.rating_updated_at is distinct from old.rating_updated_at
       or new.last_rating_recalculated_at is distinct from old.last_rating_recalculated_at then
        raise exception 'STAFF_FIELD_READ_ONLY' using errcode = '42501';
    end if;

    if new.user_id is distinct from old.user_id and new.user_id is not null then
        raise exception 'STAFF_USER_LINK_FORBIDDEN' using errcode = '42501';
    end if;

    if (new.user_id, new.branch_id, new.is_active, new.email, new.phone,
        new.percent_master, new.percent_salon, new.hourly_rate)
       is distinct from
       (old.user_id, old.branch_id, old.is_active, old.email, old.phone,
        old.percent_master, old.percent_salon, old.hourly_rate)
       and not public.staff_write_allowed(old.biz_id, new.branch_id) then
        raise exception 'STAFF_WRITE_FORBIDDEN' using errcode = '42501';
    end if;

    return new;
end;
$$;

revoke all on function public.staff_guard_client_write() from public, anon, authenticated;
