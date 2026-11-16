begin;

-- 1. Telegram mobile sign-in attempts hold nonce/exchange_code/user_id.
-- Created without RLS or REVOKE, so default Supabase grants exposed it through
-- PostgREST. The application reaches it only with the service role.
alter table public.telegram_mobile_auth_attempts enable row level security;
revoke all on table public.telegram_mobile_auth_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.telegram_mobile_auth_attempts to service_role;

-- 2. Verified identity columns on profiles are written only by provider
-- verification flows (service role / SECURITY DEFINER commands). A user session
-- can still edit its own name, contact phone and notification preferences, but
-- can no longer mark a WhatsApp/Telegram/Yandex identity as its own.
-- SECURITY INVOKER on purpose: current_user is the role running the statement
-- (definer commands run as their owner and are not affected).
create or replace function public.protect_profile_identity_columns()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
    if current_user not in ('anon', 'authenticated') then
        return new;
    end if;

    if tg_op = 'INSERT' then
        new.whatsapp_phone := null;
        new.whatsapp_verified := false;
        new.telegram_id := null;
        new.telegram_username := null;
        new.telegram_photo_url := null;
        new.telegram_verified := false;
        new.yandex_id := null;
        new.yandex_username := null;
    else
        new.whatsapp_phone := old.whatsapp_phone;
        new.whatsapp_verified := old.whatsapp_verified;
        new.telegram_id := old.telegram_id;
        new.telegram_username := old.telegram_username;
        new.telegram_photo_url := old.telegram_photo_url;
        new.telegram_verified := old.telegram_verified;
        new.yandex_id := old.yandex_id;
        new.yandex_username := old.yandex_username;
    end if;

    return new;
end;
$$;

revoke all on function public.protect_profile_identity_columns() from public, anon, authenticated;

drop trigger if exists profiles_protect_identity_columns on public.profiles;
create trigger profiles_protect_identity_columns
    before insert or update on public.profiles
    for each row execute function public.protect_profile_identity_columns();

-- 3. Promotion helpers are SECURITY DEFINER without search_path and were
-- callable by anyone: any caller could read the paid-visit count of any client
-- at any branch. Only definer commands (apply_promotion_to_booking etc.) and
-- the service role need them.
alter function public.get_client_visit_count(uuid, uuid) set search_path = public, pg_temp;
alter function public.can_use_promotion(uuid, uuid, uuid) set search_path = public, pg_temp;
revoke execute on function public.get_client_visit_count(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_use_promotion(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_client_visit_count(uuid, uuid) to service_role;
grant execute on function public.can_use_promotion(uuid, uuid, uuid) to service_role;

-- 4. Frontend metrics were world-readable (policy USING (true) without a role).
-- Writes already go through log_frontend_metric (service role only); no
-- application path reads the table with a user session.
drop policy if exists "Allow read access to frontend metrics" on public.frontend_metrics;
revoke select on table public.frontend_metrics from public, anon, authenticated;

commit;
