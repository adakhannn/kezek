import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import cronJobs from '@/config/cronJobs.json';
import { alreadyReportedUnavailableResponse, createErrorResponse } from '@/lib/apiErrorHandler';
import { logError, logWarn } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export type CronExecutionStore = {
    start: (id: string, job: string) => Promise<void>;
    finish: (id: string, outcome: 'succeeded' | 'failed', status: number, code?: string) => Promise<void>;
};

export function createCronExecutionStore(): CronExecutionStore {
    const client = getServiceClient();
    const checked = async (call: PromiseLike<{ error: unknown }>) => {
        const { error } = await call;
        if (error) throw new Error('CRON_TRACKING_UNAVAILABLE', { cause: error });
    };
    return {
        start: async (id, job) => checked(client.rpc('start_cron_execution', { p_id: id, p_job: job })
            .abortSignal(AbortSignal.timeout(3000))),
        finish: async (id, outcome, status, code = '') => checked(client.rpc('finish_cron_execution', {
            p_id: id, p_outcome: outcome, p_http_status: status, p_error_code: code,
        }).abortSignal(AbortSignal.timeout(3000))),
    };
}

/**
 * Flat fields of a tracking failure and its Supabase cause: Sentry collapses nested objects to
 * `[Object]`, so code/message must sit at depth 1. An AbortError/TimeoutError name means the 3 s timeout.
 */
export function trackingErrorLogData(error: unknown): Record<string, unknown> {
    const describe = (value: unknown) => {
        if (!value || typeof value !== 'object') return value === undefined ? {} : { message: String(value) };
        const { name, message, code } = value as { name?: unknown; message?: unknown; code?: unknown };
        return {
            name: typeof name === 'string' ? name : undefined,
            message: typeof message === 'string' ? message : undefined,
            code: typeof code === 'string' || typeof code === 'number' ? String(code) : undefined,
        };
    };
    const outer = describe(error);
    const cause = error instanceof Error ? describe(error.cause) : {};
    return {
        errorName: outer.name, errorMessage: outer.message,
        code: cause.code ?? outer.code, causeName: cause.name, causeMessage: cause.message,
    };
}

/** Call only after cron authentication. A success receipt must survive process exit. */
export async function trackCronExecution(
    job: string,
    action: () => Promise<NextResponse>,
    storeFactory: () => CronExecutionStore = createCronExecutionStore,
): Promise<NextResponse> {
    if (!cronJobs.some(definition => definition.id === job)) throw new Error('UNKNOWN_CRON_JOB');
    const id = randomUUID();
    let store: CronExecutionStore;
    try {
        store = storeFactory();
        await store.start(id, job);
    } catch (error) {
        // Nothing ran, and the scheduler calls again on the next tick; the health check flags a job
        // that stays overdue. A single blip is a warning, and the 503 is not reported a second time.
        logWarn('CronExecution', 'Execution tracking is unavailable; job not started',
            { job, executionId: id, ...trackingErrorLogData(error) });
        return alreadyReportedUnavailableResponse('Cron execution tracking is unavailable');
    }
    let response: NextResponse;
    try {
        response = await action();
    } catch (error) {
        try { await store.finish(id, 'failed', 500, 'handler_failed'); }
        catch (finishError) {
            logError('CronExecution', 'Failed to record failed job', { job, executionId: id, ...trackingErrorLogData(finishError) });
        }
        throw error;
    }
    let succeeded = response.ok;
    try {
        const body: unknown = await response.clone().json();
        succeeded &&= !!body && typeof body === 'object' && 'ok' in body && body.ok === true;
    } catch { succeeded = false; }
    const recordedStatus = !succeeded && response.ok ? 500 : response.status;
    try {
        await store.finish(id, succeeded ? 'succeeded' : 'failed', recordedStatus,
            succeeded ? '' : 'handler_unsuccessful');
    } catch (error) {
        // Work may already have committed. Expose uncertainty, do not report a
        // durable success or blindly invoke the action a second time.
        logError('CronExecution', 'Job finished but receipt is unavailable',
            { job, executionId: id, ...trackingErrorLogData(error) });
        return alreadyReportedUnavailableResponse('Cron result could not be recorded; inspect execution status before retrying');
    }
    if (!succeeded && response.ok) {
        return createErrorResponse('internal', 'Cron handler returned an unsuccessful result', undefined, 500);
    }
    return response;
}
