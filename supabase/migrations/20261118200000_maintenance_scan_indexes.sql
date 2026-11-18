-- Indexes for two maintenance jobs that read whole tables on every run (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md DB-12). purge_expired_holds() runs every minute
-- (pg_cron purge_expired_holds) with `where status = 'hold' and expires_at < now()`, but no
-- bookings index contains expires_at and status is only a trailing key of composite indexes;
-- PostgreSQL 17 has no btree skip scan, so each run walked every booking, and abandoned holds
-- only add cancelled rows. prune_booking_notifications() runs after every outbox worker pass
-- with `(completed_at < X or prepared_at < X) and payloads_pruned_at is null` and sorted the
-- whole outbox, whose rows are kept forever as tombstones. Partial indexes cover exactly the
-- live rows each job looks for (holds last 2 minutes; unpruned outbox events), as
-- whatsapp_inbox_retention already does. Functions, schedules and results do not change.
begin;

set local lock_timeout = '5s';

create index if not exists bookings_hold_expires_at_idx
    on public.bookings (expires_at)
    where status = 'hold';

create index if not exists booking_notification_outbox_completed_retention
    on public.booking_notification_outbox (completed_at)
    where payloads_pruned_at is null;

create index if not exists booking_notification_outbox_prepared_retention
    on public.booking_notification_outbox (prepared_at)
    where payloads_pruned_at is null;

commit;
