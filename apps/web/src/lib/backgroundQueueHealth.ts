import type { SupabaseClient } from '@supabase/supabase-js';

const queues = [
    { job: 'booking-notifications', flag: 'BOOKING_NOTIFICATION_WORKER_ENABLED', rpc: 'booking_notification_backlog_health' },
    { job: 'whatsapp-inbox', flag: 'WHATSAPP_INBOX_WORKER_ENABLED', rpc: 'whatsapp_inbox_backlog_health' },
] as const;
const countKeys = ['pending', 'due', 'processing', 'failed', 'ambiguous'] as const;
export type QueueCounts = Record<typeof countKeys[number], number> & { oldest_due_age_seconds: number };
export type BackgroundQueueHealth = {
    job: typeof queues[number]['job'];
    status: 'disabled' | 'healthy' | 'backlog' | 'failed';
    counts: QueueCounts | null;
};

/** Successful cron receipts do not prove the worker keeps up with incoming work. */
export async function readBackgroundQueueHealth(
    client: Pick<SupabaseClient, 'rpc'>,
    env: Record<string, string | undefined> = process.env,
): Promise<BackgroundQueueHealth[]> {
    return Promise.all(queues.map(async queue => {
        if (env[queue.flag] !== 'true') return { job: queue.job, status: 'disabled' as const, counts: null };
        const { data, error } = await client.rpc(queue.rpc).abortSignal(AbortSignal.timeout(3000));
        if (error || !data || typeof data !== 'object' || Array.isArray(data)
            || countKeys.some(key => !Number.isSafeInteger(data[key]) || data[key] < 0)
            || !Number.isFinite(data.oldest_due_age_seconds) || data.oldest_due_age_seconds < 0) {
            throw new Error('QUEUE_HEALTH_UNAVAILABLE');
        }
        const counts: QueueCounts = { pending: data.pending, due: data.due, processing: data.processing,
            failed: data.failed, ambiguous: data.ambiguous, oldest_due_age_seconds: data.oldest_due_age_seconds };
        const status = counts.failed > 0 || counts.ambiguous > 0 ? 'failed'
            : counts.due > 0 && counts.oldest_due_age_seconds > 300 ? 'backlog' : 'healthy';
        return { job: queue.job, status, counts };
    }));
}
