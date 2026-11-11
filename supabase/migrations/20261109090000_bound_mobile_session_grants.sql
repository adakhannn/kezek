begin;

-- Old attempts have no initiator proof and fail closed after deployment.
alter table public.telegram_mobile_auth_attempts add column code_challenge text
    check (code_challenge is null or code_challenge ~ '^[a-f0-9]{64}$');
alter table public.whatsapp_otp_codes add column code_challenge text
    check (code_challenge is null or code_challenge ~ '^[a-f0-9]{64}$');

alter table public.telegram_mobile_auth_attempts
    add column source jsonb,
    add column telegram_context jsonb,
    add column linkage text check (linkage is null or linkage in ('existing', 'created'));

-- No session credentials stored. Only the initiating client receives the raw code.
create table public.mobile_session_grants (
    code_hash text primary key check (code_hash ~ '^[a-f0-9]{64}$'),
    code_challenge text not null check (code_challenge ~ '^[a-f0-9]{64}$'),
    user_id uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '2 minutes'),
    consumed_at timestamptz
);
create index mobile_session_grants_expiry_idx on public.mobile_session_grants(expires_at);
alter table public.mobile_session_grants enable row level security;
revoke all on public.mobile_session_grants from public, anon, authenticated;
grant select, insert, delete on public.mobile_session_grants to service_role;

create function public.create_mobile_session_grant(p_code_hash text, p_code_challenge text, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
    -- Bound the work per issuance; expired grants never authorize redemption.
    delete from public.mobile_session_grants where code_hash in (
        select code_hash from public.mobile_session_grants
        where expires_at <= now() order by expires_at limit 500
    );
    insert into public.mobile_session_grants(code_hash, code_challenge, user_id)
    values (p_code_hash, p_code_challenge, p_user_id);
end $$;
revoke all on function public.create_mobile_session_grant(text,text,uuid) from public, anon, authenticated;
grant execute on function public.create_mobile_session_grant(text,text,uuid) to service_role;

create function public.consume_mobile_session_grant(p_code_hash text, p_code_challenge text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target_user uuid;
begin
    -- UPDATE locks the row and rechecks the predicate after a concurrent consumer.
    update public.mobile_session_grants
       set consumed_at = now()
     where code_hash = p_code_hash and code_challenge = p_code_challenge
       and consumed_at is null and expires_at > now()
     returning user_id into target_user;
    return target_user;
end $$;
revoke all on function public.consume_mobile_session_grant(text,text) from public, anon, authenticated;
grant execute on function public.consume_mobile_session_grant(text,text) to service_role;

-- Provider proof is consumed before any user creation or grant issuance. A
-- concurrent verify cannot produce another grant from the same OTP attempt.
create function public.consume_whatsapp_mobile_otp(p_attempt_id uuid, p_otp_hash text, p_code_challenge text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed uuid;
begin
    update public.whatsapp_otp_codes
       set used_at = now(), consumed_at = now(), status = 'consumed'
     where id = p_attempt_id and otp_hash = p_otp_hash and code_challenge = p_code_challenge
       and used_at is null and consumed_at is null and status = 'pending'
       and expires_at > now() and coalesce(failed_attempts, 0) < 5
       and (locked_until is null or locked_until <= now())
     returning id into claimed;
    return claimed is not null;
end $$;
revoke all on function public.consume_whatsapp_mobile_otp(uuid,text,text) from public, anon, authenticated;
grant execute on function public.consume_whatsapp_mobile_otp(uuid,text,text) to service_role;

-- Wrong-code counters also serialize on the attempt row: concurrent failures
-- cannot overwrite each other's increment or resurrect a consumed attempt.
create function public.register_whatsapp_mobile_otp_failure(p_attempt_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare failures integer;
begin
    update public.whatsapp_otp_codes
       set failed_attempts = coalesce(failed_attempts, 0) + 1,
           status = case when coalesce(failed_attempts, 0) + 1 >= 5 then 'failed' else 'pending' end,
           locked_until = case when coalesce(failed_attempts, 0) + 1 >= 5 then now() + interval '10 minutes' else locked_until end
     where id = p_attempt_id and used_at is null and consumed_at is null
       and status = 'pending' and expires_at > now() and coalesce(failed_attempts, 0) < 5
     returning failed_attempts into failures;
    return coalesce(failures, 5);
end $$;
revoke all on function public.register_whatsapp_mobile_otp_failure(uuid) from public, anon, authenticated;
grant execute on function public.register_whatsapp_mobile_otp_failure(uuid) to service_role;

comment on table public.mobile_session_grants is
    'One-use PKCE-bound verified identity grants. Delete expired rows via service-role retention maintenance; never store Auth access/refresh tokens.';
commit;
