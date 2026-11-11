import { evaluateCronHealth, readCronExecutionHealth, type CronHealthRow } from '@/lib/cronExecutionHealth';
const now = new Date('2026-11-10T12:00:00Z');
const row: CronHealthRow = { job: 'close-shifts', last_started_at: '2026-11-10T11:55:00Z',
    last_completed_at: '2026-11-10T11:56:00Z', last_success_at: '2026-11-10T11:56:00Z',
    last_failure_at: null, oldest_running_at: null, running_count: 0 };
const status = (patch: Partial<CronHealthRow>) => evaluateCronHealth([{ ...row, ...patch }], now, {})[0].status;
test('distinguishes healthy, missed, failed and abandoned executions', () => {
    expect(status({})).toBe('healthy');
    expect(status({ last_success_at: '2026-11-10T11:40:00Z' })).toBe('overdue');
    expect(status({ last_failure_at: '2026-11-10T11:58:00Z' })).toBe('failed');
    expect(status({ oldest_running_at: '2026-11-10T11:30:00Z', running_count: 1 })).toBe('stuck');
});
test('unknown deployment is unobserved and disabled notifications are explicit', () => {
    const statuses = evaluateCronHealth([], now, {});
    expect(statuses.find(job => job.job === 'close-shifts')?.status).toBe('unobserved');
    expect(statuses.find(job => job.job === 'booking-notifications')?.status).toBe('disabled');
    expect(evaluateCronHealth([], now, { BOOKING_NOTIFICATION_WORKER_ENABLED: 'true' }).find(job => job.job === 'booking-notifications')?.status).toBe('unobserved');
});
test('an initial running job is not falsely marked as missed', () => {
    expect(status({ last_success_at: null, oldest_running_at: '2026-11-10T11:59:00Z', running_count: 1 })).toBe('running');
});
test.each([{ data: null, error: new Error('down') }, { data: [{ ...row, last_success_at: 'invalid' }], error: null }])('read failure cannot appear healthy', async response => {
    const abortSignal = jest.fn().mockResolvedValue(response);
    await expect(readCronExecutionHealth({ rpc: jest.fn().mockReturnValue({ abortSignal }) }, now)).rejects.toThrow('CRON_HEALTH_UNAVAILABLE');
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
});
