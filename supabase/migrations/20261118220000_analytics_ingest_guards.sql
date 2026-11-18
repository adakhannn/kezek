-- Analytics ingest guards in the database (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md API-09).
-- /api/funnel-events and /admin/api/analytics/track accepted any body from anyone and wrote it
-- through the service role; the routes now limit, bound and validate what they accept. Here:
--   * client roles lose the default table grants on both tables (no client policy ever let them
--     in; only the service role writes and reads);
--   * size limits for the free-text and metadata columns, NOT VALID so existing rows are not
--     rechecked, valid for every new or updated row;
--   * a referenced branch, service or master must belong to the event's business, with the
--     ENG-67 guard (private.tenant_reference_guard).
begin;

set local lock_timeout = '5s';

revoke all on table public.analytics_events, public.funnel_events from anon, authenticated;

alter table public.analytics_events
    add constraint analytics_events_bounded check (
        length(event_type) <= 64
        and length(source) <= 32
        and (session_id is null or length(session_id) <= 64)
        and pg_column_size(metadata) <= 4096
    ) not valid;

-- funnel_events already checks event_type, source, session_id, user_agent and referrer.
alter table public.funnel_events
    add constraint funnel_events_metadata_bounded check (metadata is null or pg_column_size(metadata) <= 4096) not valid;

drop trigger if exists tenant_reference_guard on public.funnel_events;
create trigger tenant_reference_guard before insert or update on public.funnel_events
    for each row execute function private.tenant_reference_guard('branch_id:branches', 'service_id:services', 'staff_id:staff');

drop trigger if exists tenant_reference_guard on public.analytics_events;
create trigger tenant_reference_guard before insert or update on public.analytics_events
    for each row execute function private.tenant_reference_guard('branch_id:branches');

commit;
