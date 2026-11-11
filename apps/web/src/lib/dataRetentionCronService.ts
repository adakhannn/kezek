import type { SupabaseClient } from '@supabase/supabase-js';

type ServiceClientLike = Pick<SupabaseClient, 'rpc'>;
type Summary = Record<string, number | string>;
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
] as const;

/** Independent cleanup commands keep their own committed results on partial failure. */
export async function runDataRetention({ supabase }: { supabase: ServiceClientLike }): Promise<
    | { ok: true; data: Summary & { message: string } }
    | { ok: false; error: 'internal'; message: string; status: 500; details: Summary }
> {
    const result: Summary = {};
    for (const step of STEPS) {
        try {
            const { data, error } = await supabase.rpc(step.rpc, step.params);
            if (error) result[step.error] = error.message || step.rpc + ' failed';
            else if (!Number.isSafeInteger(data) || data < 0) result[step.error] = 'Cleanup count is unconfirmed';
            else result[step.count] = data;
        } catch {
            // A lost response may follow a committed cleanup. Do not turn it into
            // a zero counter or retry this step inside the same request.
            result[step.error] = 'Cleanup outcome is unconfirmed';
            return { ok: false, error: 'internal', message: 'Data retention outcome is unconfirmed', status: 500, details: result };
        }
    }
    if (STEPS.some(step => step.error in result)) {
        return { ok: false, error: 'internal', message: 'Some data retention steps failed', status: 500, details: result };
    }
    return { ok: true, data: { message: 'Data retention run completed', ...result } };
}
