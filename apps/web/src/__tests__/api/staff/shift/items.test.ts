import { POST } from '@/app/api/staff/shift/items/route';

jest.mock('@/lib/authBiz', () => ({ getStaffContextForRequest: jest.fn(), getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({
    checkVerifiedPrincipalRateLimit: jest.fn(async () => ({success: true})), withRateLimit: jest.fn((_req, _config, handler) => handler()), RateLimitConfigs: { normal: {} } }));
jest.mock('@/lib/apiMetrics', () => ({ logApiMetric: jest.fn(() => Promise.resolve()), getIpAddress: jest.fn(() => '127.0.0.1'), determineErrorType: jest.fn(() => null) }));
jest.mock('@/lib/time', () => ({ TZ: 'Asia/Bishkek', formatDateInTz: jest.fn(() => '2024-01-26') }));

import { getStaffContextForRequest } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

const supabase = { from: jest.fn(), rpc: jest.fn() };
const items = [{ clientName: 'Ivan Ivanov', serviceName: 'Haircut', serviceAmount: 1000, consumablesAmount: 100 }];
const request = (body: unknown) => new Request('http://localhost/api/staff/shift/items', { method: 'POST', body: JSON.stringify({ expectedShiftId: '11111111-1111-4111-8111-111111111111', expectedRevision: 7, ...(body as object) }) });

describe('/api/staff/shift/items', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        supabase.rpc.mockReset().mockResolvedValue({ data: { ok: true, shift_id: 'shift-1', revision: 8, items }, error: null });
        (getStaffContextForRequest as jest.Mock).mockResolvedValue({ supabase, staffId: 'staff-1', bizId: 'biz-1', userId: 'user-1' });
    });

    test('saves the validated ledger through one caller-bound atomic command', async () => {
        const response = await POST(request({ items, expectedRevision: 7 }));
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ ok: true, data: { shiftId: 'shift-1', revision: 8, items } });
        expect(supabase.rpc).toHaveBeenCalledTimes(1);
        expect(supabase.rpc).toHaveBeenCalledWith('save_staff_shift_command', {
            p_staff_id: 'staff-1', p_biz_id: 'biz-1', p_actor_id: 'user-1', p_shift_date: null,
            p_items: expect.arrayContaining([expect.objectContaining(items[0])]), p_allow_create: false, p_expected_revision: 7, p_expected_shift_id: '11111111-1111-4111-8111-111111111111',
        });
        expect(supabase.from).not.toHaveBeenCalled();
        expect(getServiceClient).not.toHaveBeenCalled();
    });

    test('passes an empty replacement to the transactional command', async () => {
        const response = await POST(request({ items: [] }));
        expect(response.status).toBe(200);
        expect((await response.json()).ok).toBe(true);
        expect(supabase.rpc).toHaveBeenCalledWith('save_staff_shift_command', expect.objectContaining({ p_items: [], p_expected_revision: 7 }));
    });

    test('rejects missing items before any command', async () => {
        const response = await POST(request({}));
        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe('validation');
        expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test.each([
        { expectedRevision: undefined }, { expectedShiftId: undefined },
        { expectedRevision: null }, { expectedShiftId: null },
        { expectedRevision: Number.MAX_SAFE_INTEGER + 1 }, { expectedRevision: -1 },
    ])('rejects missing or invalid snapshot identity %j before any command', async version => {
        const response = await POST(request({ items, ...version }));
        expect(response.status).toBe(400);
        expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test.each([
        ['22023', 400, 'validation'],
        ['40001', 409, 'validation'],
        ['42501', 403, 'forbidden'],
        ['XX000', 500, 'internal'],
    ])('maps command failure %s without a partial-write fallback', async (code, status, error) => {
        supabase.rpc.mockResolvedValue({ data: null, error: { code, message: 'command rejected' } });
        const response = await POST(request({ items }));
        expect(response.status).toBe(status);
        expect((await response.json()).error).toBe(error);
        expect(supabase.rpc).toHaveBeenCalledTimes(1);
        expect(supabase.from).not.toHaveBeenCalled();
    });

    test('denies a context missing the verified actor before issuing a command', async () => {
        (getStaffContextForRequest as jest.Mock).mockResolvedValue({ supabase, staffId: 'staff-1', bizId: 'biz-1' });
        const response = await POST(request({ items }));
        expect(response.status).toBe(403);
        expect(supabase.rpc).not.toHaveBeenCalled();
    });
});
