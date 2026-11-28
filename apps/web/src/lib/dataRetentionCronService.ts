import { releaseBlockedAccountDeletions } from '@/lib/accountDeletionService';
import { logError } from '@/lib/log';
import type { DbClient } from '@/lib/supabaseTypes';

type Summary = Record<string, number | string>;
type RetentionClient = Pick<DbClient, 'rpc' | 'from' | 'auth'>;
type StepOutcome = { data: unknown; error: { message?: string } | null };

/**
 * Accounts deleted within this window get their analytics_events.client_id cleared on every run, so
 * a failed run is caught up by a later one. analytics_events has no foreign key to auth.users.
 */
export const DELETED_ACCOUNT_ANALYTICS_LOOKBACK_DAYS = 30;
const CLIENT_ID_CHUNK = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

/** client_id of analytics events of recently deleted accounts becomes null; the counts stay. */
async function anonymizeDeletedAccountsAnalytics(client: RetentionClient): Promise<StepOutcome> {
    const since = new Date(Date.now() - DELETED_ACCOUNT_ANALYTICS_LOOKBACK_DAYS * DAY_MS).toISOString();
    const { data, error } = await client.from('account_deletion_requests')
        .select('user_id')
        .eq('status', 'completed')
        .gte('completed_at', since);
    if (error) return { data: null, error };
    const ids = (data ?? []).map(row => row.user_id);
    let total = 0;
    for (let start = 0; start < ids.length; start += CLIENT_ID_CHUNK) {
        const chunk = ids.slice(start, start + CLIENT_ID_CHUNK);
        const updated = await client.from('analytics_events').update({ client_id: null }, { count: 'exact' }).in('client_id', chunk);
        if (!updated.error) {
            total += updated.count ?? 0;
            continue;
        }
        // analytics_events_bounded is NOT VALID: an oversized row written before 18 Nov fails any
        // update. Such rows of a deleted account are removed instead of keeping the identifier.
        if (updated.error.code !== '23514') return { data: null, error: updated.error };
        const removed = await client.from('analytics_events').delete({ count: 'exact' }).in('client_id', chunk);
        if (removed.error) return { data: null, error: removed.error };
        total += removed.count ?? 0;
    }
    return { data: total, error: null };
}

async function releaseBlocked(client: RetentionClient): Promise<StepOutcome> {
    try {
        return { data: await releaseBlockedAccountDeletions(client), error: null };
    } catch (error) {
        // Every write of the release is repeatable; the next run finishes what this one did not.
        logError('DataRetention', 'Blocked account deletions were not released', { error });
        return { data: null, error: { message: 'Blocked account deletions were not released' } };
    }
}

const STEPS = [
    { rpc: 'cleanup_old_api_metrics', params: { p_keep_days: 90 }, count: 'api_metrics_deleted', error: 'api_metrics_error' },
    { rpc: 'cleanup_old_finance_logs', params: { p_keep_days: 365 }, count: 'finance_logs_deleted', error: 'finance_logs_error' },
    { rpc: 'cleanup_old_funnel_events', params: { p_keep_days: 400 }, count: 'funnel_events_deleted', error: 'funnel_events_error' },
    { rpc: 'anonymize_old_bookings_pii', params: { p_older_than_days: 2555 }, count: 'bookings_pii_anonymized', error: 'bookings_pii_error' },
    { rpc: 'anonymize_inactive_profiles_pii', params: { p_inactive_days: 1095 }, count: 'profiles_pii_anonymized', error: 'profiles_pii_error' },
    { rpc: 'cleanup_expired_telegram_mobile_auth_attempts', params: { p_keep_minutes: 1440 }, count: 'telegram_mobile_attempts_deleted', error: 'telegram_mobile_attempts_error' },
    { rpc: 'finalize_due_account_deletions', params: { batch_limit: 50 }, count: 'accounts_deleted', error: 'account_deletions_error' },
    { rpc: 'prune_booking_notifications', params: { p_limit: 100 }, count: 'booking_notification_payloads_pruned', error: 'booking_notification_retention_error' },
    { rpc: 'prune_whatsapp_inbox', params: { p_limit: 100 }, count: 'whatsapp_inbox_payloads_pruned', error: 'whatsapp_inbox_retention_error' },
    // After finalize_due_account_deletions, so a request it blocked or an account it deleted in this
    // run is handled in the same run. Plain table reads and writes: nothing here needs a migration.
    { task: releaseBlocked, name: 'release_blocked_account_deletions', count: 'blocked_deletions_released', error: 'blocked_deletions_error' },
    { task: anonymizeDeletedAccountsAnalytics, name: 'anonymize_deleted_accounts_analytics', count: 'deleted_accounts_analytics_anonymized', error: 'deleted_accounts_analytics_error' },
] as const;

/** Independent cleanup commands keep their own committed results on partial failure. */
export async function runDataRetention({ supabase }: { supabase: RetentionClient }): Promise<
    | { ok: true; data: Summary & { message: string } }
    | { ok: false; error: 'internal'; message: string; status: 500; details: Summary }
> {
    const result: Summary = {};
    for (const step of STEPS) {
        const name = 'rpc' in step ? step.rpc : step.name;
        try {
            const { data, error }: StepOutcome = 'rpc' in step ? await supabase.rpc(step.rpc, step.params) : await step.task(supabase);
            if (error) result[step.error] = error.message || name + ' failed';
            else if (typeof data !== 'number' || !Number.isSafeInteger(data) || data < 0) result[step.error] = 'Cleanup count is unconfirmed';
            else result[step.count] = data;
        } catch (error) {
            // A lost response may follow a committed cleanup. Do not turn it into
            // a zero counter or retry this step inside the same request.
            logError('DataRetention', 'Cleanup step outcome is unconfirmed', { step: name, error });
            result[step.error] = 'Cleanup outcome is unconfirmed';
            return { ok: false, error: 'internal', message: 'Data retention outcome is unconfirmed', status: 500, details: result };
        }
    }
    if (STEPS.some(step => step.error in result)) {
        return { ok: false, error: 'internal', message: 'Some data retention steps failed', status: 500, details: result };
    }
    return { ok: true, data: { message: 'Data retention run completed', ...result } };
}
