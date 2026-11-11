import cronJobs from '@/config/cronJobs.json';

export type CronHealthRow = {
    job: string;
    last_started_at: string | null;
    last_completed_at: string | null;
    last_success_at: string | null;
    last_failure_at: string | null;
    oldest_running_at: string | null;
    running_count: number;
};
type HealthClient = { rpc: (name: string) => {
    abortSignal: (signal: AbortSignal) => PromiseLike<{ data: unknown; error: unknown }>;
} };
export type CronHealthStatus = ReturnType<typeof evaluateCronHealth>[number];

export function evaluateCronHealth(rows: CronHealthRow[], now: Date, env: Record<string, string | undefined>) {
    return cronJobs.map(job => {
        const row = rows.find(item => item.job === job.id);
        const success = row?.last_success_at ? Date.parse(row.last_success_at) : null;
        const failure = row?.last_failure_at ? Date.parse(row.last_failure_at) : null;
        const running = row?.oldest_running_at ? Date.parse(row.oldest_running_at) : null;
        const disabled = job.enabledByEnv && env[job.enabledByEnv] !== 'true';
        const status = disabled ? 'disabled' : running !== null && now.getTime() - running > 15 * 60_000 ? 'stuck'
            : failure !== null && (success === null || failure > success) ? 'failed'
                : success === null ? running !== null ? 'running' : 'unobserved'
                    : now.getTime() - success > job.maxDelaySeconds * 1000 ? 'overdue' : 'healthy';
        return { job: job.id, status, lastSuccessAt: row?.last_success_at ?? null,
            lastStartedAt: row?.last_started_at ?? null, runningCount: row?.running_count ?? 0 };
    });
}

export async function readCronExecutionHealth(client: HealthClient, now = new Date()) {
    const { data, error } = await client.rpc('read_cron_execution_health').abortSignal(AbortSignal.timeout(3000));
    const dateFields = ['last_started_at', 'last_completed_at', 'last_success_at', 'last_failure_at', 'oldest_running_at'];
    if (error || !Array.isArray(data) || data.some(row => !row || typeof row.job !== 'string'
        || !Number.isSafeInteger(row.running_count) || row.running_count < 0
        || dateFields.some(field => row[field] !== null && (typeof row[field] !== 'string' || !Number.isFinite(Date.parse(row[field])))))) {
        throw new Error('CRON_HEALTH_UNAVAILABLE');
    }
    return evaluateCronHealth(data as CronHealthRow[], now, process.env);
}
