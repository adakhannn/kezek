-- Mobile push notifications for booking events (owner decision 2026-11-25).
--
-- public.push_tokens holds the Expo push tokens of signed-in app installs. The app registers and
-- removes its token only through POST/DELETE /api/mobile/push-tokens, which checks the caller's
-- session and writes with the service role; the outbox worker reads tokens with the service role
-- and deletes one Expo reports as DeviceNotRegistered. Client sessions get nothing: RLS is on with
-- no policies and anon/authenticated have no grants (new objects are closed by default, DB-11 —
-- the revoke below states it explicitly and also covers a database built without that default).
--
-- A token identifies one install, so it is unique: the same device signing in to another account
-- moves the token to that account instead of notifying both.

create table public.push_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    token text not null unique check (char_length(token) between 20 and 200),
    platform text not null check (platform in ('ios', 'android')),
    device_name text check (device_name is null or char_length(device_name) <= 100),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_error text check (last_error is null or char_length(last_error) <= 200)
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
revoke all on table public.push_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.push_tokens to service_role;

comment on table public.push_tokens is
    'Expo push tokens of signed-in mobile installs. Written only by the service role through /api/mobile/push-tokens and the booking notification worker.';

-- The booking outbox gains the push channel (apps/web/src/lib/notifications/outboxTransport.ts).
-- The check was declared inline in 20261110090000, so it carries the default constraint name.
alter table public.booking_notification_deliveries
    drop constraint if exists booking_notification_deliveries_channel_check;
alter table public.booking_notification_deliveries
    add constraint booking_notification_deliveries_channel_check
    check (channel in ('email', 'telegram', 'whatsapp', 'push'));
