create table if not exists public.telegram_mobile_auth_attempts (
    id uuid primary key default gen_random_uuid(),
    nonce text not null,
    status text not null,
    telegram_id bigint,
    user_id uuid references auth.users (id) on delete set null,
    exchange_code text,
    expires_at timestamptz not null,
    consumed_at timestamptz,
    created_at timestamptz not null default timezone('utc'::text, now()),
    check (
        status in ('pending', 'consumed', 'approved', 'failed', 'expired')
    )
);

comment on table public.telegram_mobile_auth_attempts is
    'Telegram mobile auth attempts for deep-link sign-in flow.';
comment on column public.telegram_mobile_auth_attempts.nonce is
    'One-time auth attempt nonce from /api/auth/telegram/mobile/start.';
comment on column public.telegram_mobile_auth_attempts.status is
    'Attempt state: pending, consumed, approved, failed, expired.';
comment on column public.telegram_mobile_auth_attempts.exchange_code is
    'One-time mobile exchange code produced after approval.';
comment on column public.telegram_mobile_auth_attempts.expires_at is
    'Attempt expiration timestamp (TTL).';
comment on column public.telegram_mobile_auth_attempts.consumed_at is
    'Timestamp when nonce was consumed by confirm flow.';

create unique index if not exists telegram_mobile_auth_attempts_nonce_uidx
    on public.telegram_mobile_auth_attempts (nonce);

create index if not exists telegram_mobile_auth_attempts_status_expires_idx
    on public.telegram_mobile_auth_attempts (status, expires_at);
