-- Granular public/QuickDesk funnel events are distinct from the coarse
-- analytics_events model used by daily business aggregates.
-- Only trusted server handlers may read/write this anonymous event ledger.
begin;

create table public.funnel_events (
    id uuid primary key default gen_random_uuid(),
    event_type text not null check (event_type in (
        'business_view', 'branch_select', 'service_select', 'staff_select',
        'slot_select', 'booking_success', 'booking_abandon'
    )),
    source text not null check (source in ('public', 'quickdesk')),
    biz_id uuid not null references public.businesses(id) on delete cascade,
    branch_id uuid,
    service_id uuid,
    staff_id uuid,
    slot_start_at timestamptz,
    booking_id uuid,
    session_id text not null check (char_length(session_id) between 1 and 255),
    user_agent text check (char_length(user_agent) <= 500),
    referrer text check (char_length(referrer) <= 500),
    created_at timestamptz not null default now(),
    metadata jsonb
);

create index funnel_events_biz_created_idx on public.funnel_events (biz_id, created_at);
create index funnel_events_source_created_idx on public.funnel_events (source, created_at);
create index funnel_events_created_idx on public.funnel_events (created_at);

alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from public, anon, authenticated;
grant select, insert, update, delete on public.funnel_events to service_role;

comment on table public.funnel_events is
    'Anonymous granular booking funnel. Server-only; contains no profile/contact columns. Retention: cleanup_old_funnel_events.';

commit;
