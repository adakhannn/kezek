import { getPerformanceStatsSnapshot } from '@/lib/performanceStatsService';
import { readPerformanceSnapshot } from '@/lib/performanceStore';
jest.mock('@/lib/performanceStore', () => ({ readPerformanceSnapshot: jest.fn() }));
function createClient() {
    return { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'verified' } }, error: null }) }, rpc: jest.fn().mockResolvedValue({ data: true, error: null }) };
}
beforeEach(() => jest.resetAllMocks());
test.each([null, { id: 'stale' }])('unverified identity does not touch permission RPC or shared store %p', async user => {
    const client = createClient(); client.auth.getUser.mockResolvedValue({ data: { user }, error: new Error('expired') });
    expect(await getPerformanceStatsSnapshot(client)).toMatchObject({ ok: false, status: 401 });
    expect(client.rpc).not.toHaveBeenCalled(); expect(readPerformanceSnapshot).not.toHaveBeenCalled();
});
test('canonical SQL false denies without privileged metrics read', async () => {
    const client = createClient(); client.rpc.mockResolvedValue({ data: false, error: null });
    expect(await getPerformanceStatsSnapshot(client)).toMatchObject({ ok: false, status: 403 });
    expect(client.rpc).toHaveBeenCalledWith('is_super_admin'); expect(readPerformanceSnapshot).not.toHaveBeenCalled();
});
test.each([null, undefined, 'true', 1, { is_super_admin: true }])('malformed permission response %p is unavailable, never success', async data => {
    const client = createClient(); client.rpc.mockResolvedValue({ data, error: null });
    expect(await getPerformanceStatsSnapshot(client)).toMatchObject({ ok: false, status: 503 });
    expect(readPerformanceSnapshot).not.toHaveBeenCalled();
});
test('true alongside RPC error fails closed', async () => {
    const client = createClient(); client.rpc.mockResolvedValue({ data: true, error: new Error('read failed') });
    expect(await getPerformanceStatsSnapshot(client)).toMatchObject({ ok: false, status: 503 });
    expect(readPerformanceSnapshot).not.toHaveBeenCalled();
});
test('returns shared stats only after caller permission succeeds', async () => {
    const client = createClient(); const snapshot = { stats: [{ operation: 'shift_close', source: 'server', count: 10, avgDuration: 100 }, { operation: 'LCP', source: 'client', count: 5, avgDuration: 150 }], timestamp: 123, status: 'observed' };
    (readPerformanceSnapshot as jest.Mock).mockResolvedValue(snapshot);
    expect(await getPerformanceStatsSnapshot(client)).toEqual({ ok: true, data: snapshot });
    expect(client.rpc.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(readPerformanceSnapshot).mock.invocationCallOrder[0]);
});
test.each(['missing store', 'failed store'])('authorized %s is 503, not healthy zeros', async () => {
    const client = createClient(); jest.mocked(readPerformanceSnapshot).mockRejectedValue(new Error('unavailable'));
    expect(await getPerformanceStatsSnapshot(client)).toMatchObject({ ok: false, error: 'service_unavailable', status: 503 });
    expect(readPerformanceSnapshot).toHaveBeenCalledTimes(1);
});
