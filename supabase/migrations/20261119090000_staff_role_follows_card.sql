-- The staff role follows the staff card (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md ARCH-10).
--
-- Until now the web application added the 'staff' role in user_roles while resolving the staff context
-- of every request, GET pages included: two reads and possibly an insert on each staff request, a write
-- hidden in a read, and a role that existed only after the first visit to the staff cabinet. Policies
-- and role checks read that role (for example "Members can view staff of own business"), so it should
-- exist as soon as an account is linked to an active card.
--
-- A trigger now grants the role when a card is created or updated to be active and linked to an
-- account, and existing linked active cards get their missing role here. Unlinking or deactivating a
-- card does not remove the role, as before. A suspended or deleting account gets no role: the guards
-- on user_roles (prevent_roles_for_suspended, the lifecycle guard) refuse the insert, and the card is
-- still saved, as when the application granted the role on first use. Re-running changes nothing.

create or replace function private.ensure_staff_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_role uuid;
begin
    if new.user_id is null or not coalesce(new.is_active, false) then
        return new;
    end if;
    if tg_op = 'UPDATE'
        and new.user_id is not distinct from old.user_id
        and new.biz_id is not distinct from old.biz_id
        and new.is_active is not distinct from old.is_active then
        return new;
    end if;
    select id into v_role from public.roles where key = 'staff';
    if v_role is null then
        return new;
    end if;
    begin
        insert into public.user_roles (user_id, biz_id, role_id)
        values (new.user_id, new.biz_id, v_role)
        on conflict (user_id, role_id, biz_key) do nothing;
    exception when others then
        raise warning 'staff role not granted to the account of staff card %: %', new.id, sqlerrm;
    end;
    return new;
end;
$$;

-- A trigger function: nobody calls it directly.
revoke all on function private.ensure_staff_role() from public;

drop trigger if exists staff_ensure_staff_role on public.staff;
create trigger staff_ensure_staff_role
    after insert or update of user_id, biz_id, is_active on public.staff
    for each row execute function private.ensure_staff_role();

do $backfill$
declare
    v_role uuid;
    v_card record;
begin
    select id into v_role from public.roles where key = 'staff';
    if v_role is null then
        return;
    end if;
    for v_card in
        select distinct s.user_id, s.biz_id from public.staff s where s.user_id is not null and s.is_active
    loop
        begin
            insert into public.user_roles (user_id, biz_id, role_id)
            values (v_card.user_id, v_card.biz_id, v_role)
            on conflict (user_id, role_id, biz_key) do nothing;
        exception when others then
            raise warning 'staff role not granted to account %: %', v_card.user_id, sqlerrm;
        end;
    end loop;
end
$backfill$;
