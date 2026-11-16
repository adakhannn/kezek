begin;

create table public.telegram_web_login_attempts (
    token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
    browser_hash text not null check (browser_hash ~ '^[a-f0-9]{64}$'),
    status text not null default 'pending' check (status in ('pending','approved','consumed','cancelled','expired')),
    telegram_id bigint check (telegram_id > 0),
    telegram_name text,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '5 minutes')
);
create index telegram_web_login_expiry_idx on public.telegram_web_login_attempts(expires_at);
alter table public.telegram_web_login_attempts enable row level security;
revoke all on public.telegram_web_login_attempts from public, anon, authenticated;
grant select, insert, delete on public.telegram_web_login_attempts to service_role;

-- Browser actions require a separate secret, never included in the bot link.
-- No account creation, reassignment, password changes or auth session storage.
create function public.transition_telegram_web_login(
    p_hash text, p_action text, p_browser text default null,
    p_telegram bigint default null, p_name text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    a public.telegram_web_login_attempts%rowtype;
    uid uuid;
begin
    if p_action not in ('claim','approve','cancel_bot','cancel','finish') then
        return jsonb_build_object('error','invalid_action');
    end if;
    select * into a from public.telegram_web_login_attempts where token_hash = p_hash for update;
    if not found then return jsonb_build_object('error','not_found'); end if;
    if p_action in ('cancel','finish') and (p_browser is null or p_browser <> a.browser_hash) then
        return jsonb_build_object('error','not_found');
    end if;
    if a.status in ('consumed','cancelled','expired') then return jsonb_build_object('error','closed'); end if;
    if a.expires_at <= now() then
        update public.telegram_web_login_attempts set status = 'expired' where token_hash = p_hash;
        return jsonb_build_object('error','expired');
    end if;
    if p_action = 'cancel' then
        update public.telegram_web_login_attempts set status = 'cancelled' where token_hash = p_hash;
        return jsonb_build_object('status','cancelled');
    end if;
    if p_telegram is null or p_telegram <= 0 then return jsonb_build_object('error','invalid_account'); end if;
    if a.telegram_id is not null and a.telegram_id <> p_telegram then
        return jsonb_build_object('error','different_account');
    end if;
    if p_action = 'claim' then
        update public.telegram_web_login_attempts set telegram_id = p_telegram,
            telegram_name = left(p_name, 160) where token_hash = p_hash;
        return jsonb_build_object('status',a.status);
    end if;
    if a.telegram_id is null then return jsonb_build_object('error','not_claimed'); end if;
    if p_action = 'cancel_bot' then
        update public.telegram_web_login_attempts set status = 'cancelled' where token_hash = p_hash;
        return jsonb_build_object('status','cancelled');
    end if;
    if p_action = 'approve' then
        update public.telegram_web_login_attempts set status = 'approved' where token_hash = p_hash;
        return jsonb_build_object('status','approved');
    end if;
    if a.status <> 'approved' then return jsonb_build_object('error','not_approved'); end if;
    -- Resolve identity at consumption time; a stale or unlinked Telegram cannot log in.
    select id into uid from public.profiles where telegram_id = p_telegram and telegram_verified = true for share;
    if uid is null then return jsonb_build_object('error','not_linked'); end if;
    update public.telegram_web_login_attempts set status = 'consumed' where token_hash = p_hash;
    return jsonb_build_object('status','consumed','user_id',uid);
end $$;
revoke all on function public.transition_telegram_web_login(text,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.transition_telegram_web_login(text,text,text,bigint,text) to service_role;

comment on table public.telegram_web_login_attempts is 'Private short-lived browser-bound Telegram login requests. Cleanup expired rows older than one day via service-role maintenance.';
commit;
