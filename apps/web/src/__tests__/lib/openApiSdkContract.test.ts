import { ApiError, BookingsService, OpenAPI, ShiftsService } from '@shared-client/generated-sdk';
import { getStaffContextForRequest } from '@/lib/authBiz';
import { runQuickBookGuestHttp } from '@/lib/quickBookGuestHttpService';
import { runQuickHoldHttp } from '@/lib/quickHoldHttpService';
import { resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { runStaffShiftItemsHttp } from '@/lib/staffShiftItemsHttpService';
import { runStaffShiftCloseHttp } from '@/lib/staffShiftCloseHttpService';
import { runStaffShiftClose } from '@/lib/staffShiftCloseService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { bookingRpcResult } from '@/__tests__/lib/bookingRpcMock';

jest.mock('@/lib/requestAuthContext', () => ({ resolveRequestAuthContext: jest.fn() }));
jest.mock('@/lib/authBiz', () => ({ getStaffContextForRequest: jest.fn(), getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/staffShiftCloseService', () => ({ runStaffShiftClose: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({
    ...jest.requireActual('@/lib/rateLimit'),
    checkVerifiedPrincipalRateLimit: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('@/lib/apiMetrics', () => ({ logApiMetric: jest.fn().mockResolvedValue(undefined), getIpAddress: () => 'unit', determineErrorType: () => undefined }));
jest.mock('@/lib/log', () => ({ logError: jest.fn() }));

const uuid = '11111111-1111-4111-8111-111111111111';
const key = '22222222-2222-4222-8222-222222222222';
const booking = { biz_id: uuid, branch_id: uuid, staff_id: uuid, service_id: uuid, start_at: '2035-01-01T10:00:00Z' };
const rpc = jest.fn();
const originalFetch = global.fetch;
let requests: Request[];

beforeEach(() => {
    jest.clearAllMocks();
    requests = [];
    OpenAPI.BASE = 'https://unit.invalid';
    OpenAPI.TOKEN = 'synthetic-unit-token';
    OpenAPI.WITH_CREDENTIALS = false;
    jest.mocked(resolveRequestAuthContext).mockResolvedValue({ supabase: { rpc }, user: { id: uuid }, authSource: 'bearer' } as never);
    jest.mocked(createSupabaseAdminClient).mockReturnValue({ rpc } as never);
    jest.mocked(getStaffContextForRequest).mockResolvedValue({ supabase: { rpc }, userId: uuid, staffId: uuid, bizId: uuid } as never);
    global.fetch = jest.fn(async (url, init) => {
        const req = new Request(String(url), init);
        requests.push(req.clone());
        switch (new URL(req.url).pathname) {
            case '/api/quick-hold': return runQuickHoldHttp(req);
            case '/api/quick-book-guest': return runQuickBookGuestHttp(req);
            case '/api/staff/shift/items': return runStaffShiftItemsHttp(req);
            case '/api/staff/shift/close': return runStaffShiftCloseHttp(req);
            default: throw new Error('Unmocked SDK request');
        }
    });
});
afterEach(() => { global.fetch = originalFetch; OpenAPI.TOKEN = undefined; OpenAPI.BASE = ''; });

test('generated authenticated booking wire passes real validation and preserves the caller identity', async () => {
    rpc.mockReturnValue(bookingRpcResult({ data: { booking_id: uuid, confirmed: true }, error: null }));
    const result = await BookingsService.quickHold({ idempotencyKey: key, requestBody: booking });
    expect(result).toEqual({ ok: true, data: { booking_id: uuid, confirmed: true } });
    expect(requests[0].headers.get('Authorization')).toBe('Bearer synthetic-unit-token');
    expect(rpc).toHaveBeenCalledWith('create_confirmed_booking', expect.objectContaining({ p_request_id: key, p_guest_secret: null, p_actor_id: uuid }));
});

test('generated guest booking carries durable proof and supports services-only normalization', async () => {
    rpc.mockReturnValue(bookingRpcResult({ data: { booking_id: uuid, confirmed: true }, error: null }));
    const { service_id: _service, ...base } = booking;
    await BookingsService.quickBookGuest({ idempotencyKey: key, xBookingClientToken: 'a'.repeat(64), requestBody: { ...base, services: [{ service_id: uuid, duration_min: 30 }], client_name: 'Unit Guest', client_phone: '+996555000111' } });
    expect(rpc).toHaveBeenCalledWith('create_confirmed_booking', expect.objectContaining({ p_request_id: key, p_guest_secret: 'a'.repeat(64), p_actor_id: null, p_payload: expect.objectContaining({ service_id: uuid }) }));
});

test('booking validation failure rejects through the generated ApiError and makes no RPC', async () => {
    await expect(BookingsService.quickHold({ idempotencyKey: key, requestBody: { ...booking, start_at: '2035-01-01T10:00:00.000Z' } })).rejects.toMatchObject({ status: 400, body: { ok: false, error: 'validation' } });
    expect(rpc).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('Save sends the original revision and returns canonical row identity with fractional amounts', async () => {
    const item = { id: uuid, clientName: 'Unit', serviceName: 'Service', serviceAmount: 12.5, consumablesAmount: 0, bookingId: null };
    rpc.mockResolvedValue({ data: { ok: true, shift_id: uuid, revision: 8, items: [item] }, error: null });
    const result = await ShiftsService.saveShiftItems({ requestBody: { expectedShiftId: uuid, expectedRevision: 7, items: [{ clientId: key, serviceAmount: 12.5 }] } });
    expect(rpc).toHaveBeenCalledWith('save_staff_shift_command', expect.objectContaining({ p_expected_revision: 7, p_expected_shift_id: uuid, p_actor_id: uuid, p_items: [expect.objectContaining({ clientId: key, serviceAmount: 12.5, consumablesAmount: 0 })] }));
    expect(result.data).toEqual({ shiftId: uuid, revision: 8, items: [item] });
});

test('409 is surfaced with no automatic retry or revision replacement', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'stale' } });
    let failure: unknown;
    try { await ShiftsService.saveShiftItems({ requestBody: { expectedShiftId: uuid, expectedRevision: 7, items: [] } }); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 409, body: { ok: false, error: 'validation' } });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledTimes(1);
});

test.each([
    { expectedShiftId: uuid, expectedRevision: null, items: [] },
    { expectedShiftId: uuid, expectedRevision: -1, items: [] },
    { expectedShiftId: uuid, expectedRevision: 1.5, items: [] },
    { expectedShiftId: uuid, expectedRevision: 7, items: [{ serviceAmount: 100000001 }] },
])('real Save validator rejects invalid revisions and amounts (%j)', async requestBody => {
    await expect(ShiftsService.saveShiftItems({ requestBody })).rejects.toMatchObject({ status: 400 });
    expect(rpc).not.toHaveBeenCalled();
});

test('Close uses its own reviewed envelope and preserves the snapshot pair', async () => {
    jest.mocked(runStaffShiftClose).mockResolvedValue({ ok: true, shift: { id: uuid, status: 'closed', ledger_revision: 9 } } as never);
    const result = await ShiftsService.closeShift({ requestBody: { expectedShiftId: uuid, expectedRevision: 8, totalAmount: 0 } });
    expect(runStaffShiftClose).toHaveBeenCalledWith(expect.objectContaining({ expectedShiftId: uuid, expectedRevision: 8, actorId: uuid }));
    expect(result.data.shift).toEqual({ id: uuid, status: 'closed', ledger_revision: 9 });
});
