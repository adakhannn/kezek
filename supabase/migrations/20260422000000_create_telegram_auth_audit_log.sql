-- Audit-лог событий авторизации через Telegram-бота (mobile deep-link flow)

create table if not exists public.telegram_auth_audit_log (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default timezone('utc'::text, now()),
    event_type text not null,
    nonce text,
    telegram_id bigint,
    decision text,
    status text,
    user_id uuid references auth.users (id) on delete set null,
    linkage text,
    reason text,
    metadata jsonb not null default '{}'::jsonb
);

comment on table public.telegram_auth_audit_log is 'Audit-лог Telegram bot авторизации для mobile deep-link flow.';
comment on column public.telegram_auth_audit_log.event_type is 'Тип события: mobile_start_created, bot_start_opened, bot_decision_received, bot_login_approved, bot_login_cancelled, bot_login_failed.';
comment on column public.telegram_auth_audit_log.nonce is 'Идентификатор auth-attempt (одноразовый nonce).';
comment on column public.telegram_auth_audit_log.telegram_id is 'Telegram user id, от имени которого выполнено действие.';
comment on column public.telegram_auth_audit_log.metadata is 'Дополнительный контекст события (chatId, ошибка, source и т.д.).';

create index if not exists telegram_auth_audit_log_created_idx
    on public.telegram_auth_audit_log (created_at desc);
create index if not exists telegram_auth_audit_log_nonce_idx
    on public.telegram_auth_audit_log (nonce, created_at desc)
    where nonce is not null;
create index if not exists telegram_auth_audit_log_telegram_idx
    on public.telegram_auth_audit_log (telegram_id, created_at desc)
    where telegram_id is not null;

alter table public.telegram_auth_audit_log enable row level security;

drop policy if exists "Telegram auth audit insert service role" on public.telegram_auth_audit_log;
create policy "Telegram auth audit insert service role"
    on public.telegram_auth_audit_log
    for insert
    to service_role
    with check (true);

drop policy if exists "Telegram auth audit select service role" on public.telegram_auth_audit_log;
create policy "Telegram auth audit select service role"
    on public.telegram_auth_audit_log
    for select
    to service_role
    using (true);
