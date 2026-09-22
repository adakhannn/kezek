-- Profile linking is deliberately separate from mobile LOGIN and session exchange.
begin;
create table public.telegram_profile_link_attempts (
    token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
    owner_id uuid not null references auth.users(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending','approved','cancelled','consumed','expired')),
    telegram_id bigint,
    telegram_username text,
    telegram_name text,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '5 minutes')
);
create index on public.telegram_profile_link_attempts(owner_id, created_at);
create index on public.telegram_profile_link_attempts(expires_at);
alter table public.telegram_profile_link_attempts enable row level security;
revoke all on public.telegram_profile_link_attempts from public, anon, authenticated;
grant select, insert, update, delete on public.telegram_profile_link_attempts to service_role;

-- Only the trusted backend may call this function. Ownership and Telegram actor
-- are supplied from verified sessions / authenticated webhook, never browser identity.
create function public.transition_telegram_profile_link(
    p_hash text, p_action text, p_owner uuid default null,
    p_telegram bigint default null, p_username text default null, p_name text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
    a public.telegram_profile_link_attempts%rowtype;
    current_telegram bigint;
begin
    select * into a from public.telegram_profile_link_attempts where token_hash = p_hash for update;
    if not found then return jsonb_build_object('error','not_found'); end if;
    if p_action in ('finish','cancel_owner') then
        if p_owner is null or a.owner_id <> p_owner then return jsonb_build_object('error','not_found'); end if;
    elsif p_action not in ('claim','approve','cancel_bot') or p_telegram is null or p_telegram <= 0 then
        return jsonb_build_object('error','invalid_action');
    end if;
    if a.status = 'consumed' and p_action = 'finish' and a.telegram_id = p_telegram then
        return jsonb_build_object('status','consumed');
    end if;
    if a.expires_at <= now() then
        update public.telegram_profile_link_attempts set status = 'expired' where token_hash = p_hash and status in ('pending','approved');
        return jsonb_build_object('error','expired');
    end if;
    if a.status not in ('pending','approved') then return jsonb_build_object('error','closed'); end if;
    if p_action = 'cancel_owner' then
        update public.telegram_profile_link_attempts set status = 'cancelled' where token_hash = p_hash;
        return jsonb_build_object('status','cancelled');
    end if;
    if a.telegram_id is not null and a.telegram_id <> p_telegram then
        return jsonb_build_object('error','different_account');
    end if;
    if p_action = 'claim' then
        if a.status <> 'pending' then return jsonb_build_object('error','closed'); end if;
        update public.telegram_profile_link_attempts set telegram_id = p_telegram,
            telegram_username = left(p_username, 64), telegram_name = left(p_name, 128) where token_hash = p_hash;
        return jsonb_build_object('status','pending');
    end if;
    if a.telegram_id is null then return jsonb_build_object('error','not_claimed'); end if;
    if p_action in ('approve','cancel_bot') then
        update public.telegram_profile_link_attempts set status = case when p_action = 'approve' then 'approved' else 'cancelled' end where token_hash = p_hash;
        return jsonb_build_object('status',case when p_action = 'approve' then 'approved' else 'cancelled' end);
    end if;
    if p_action <> 'finish' or a.status <> 'approved' or p_telegram is null then
        return jsonb_build_object('error','not_approved');
    end if;
    select telegram_id into current_telegram from public.profiles where id = a.owner_id for update;
    if not found then return jsonb_build_object('error','profile_missing'); end if;
    if current_telegram is not null and current_telegram <> a.telegram_id then
        return jsonb_build_object('error','already_connected');
    end if;
    if exists (select 1 from public.profiles where telegram_id = a.telegram_id and id <> a.owner_id) then
        return jsonb_build_object('error','already_linked');
    end if;
    begin
        update public.profiles set telegram_id = a.telegram_id, telegram_username = a.telegram_username,
            telegram_photo_url = null, telegram_verified = true where id = a.owner_id;
        update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) ||
            jsonb_build_object('telegram_id',a.telegram_id,'telegram_username',a.telegram_username)
            where id = a.owner_id;
        update public.telegram_profile_link_attempts set status = 'consumed' where token_hash = p_hash;
    exception when unique_violation then
        return jsonb_build_object('error','already_linked');
    end;
    return jsonb_build_object('status','consumed');
end;
$$;
revoke all on function public.transition_telegram_profile_link(text,text,uuid,bigint,text,text) from public, anon, authenticated;
grant execute on function public.transition_telegram_profile_link(text,text,uuid,bigint,text,text) to service_role;

-- Run daily using the project's maintenance scheduler; no secrets are retained.
create function public.cleanup_telegram_profile_links() returns void
language sql security definer set search_path = '' as $$
    delete from public.telegram_profile_link_attempts where expires_at < now() - interval '1 day';
$$;
revoke all on function public.cleanup_telegram_profile_links() from public, anon, authenticated;
grant execute on function public.cleanup_telegram_profile_links() to service_role;
commit;
