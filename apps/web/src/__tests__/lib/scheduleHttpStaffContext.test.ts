import { scheduleHttp } from '@/lib/scheduling/server';
import { getBizContextForManagers, getStaffContextForRequest } from '@/lib/authBiz';
import { explicitSchedulingEnabled } from '@/lib/scheduling/config';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/scheduling/config', () => ({ explicitSchedulingEnabled: jest.fn() }));
jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn(), getStaffContextForRequest: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));

const STAFF = '00000000-0000-4000-8000-0000000000aa';

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(explicitSchedulingEnabled).mockReturnValue(true);
    const builder = { select: jest.fn(() => builder), eq: jest.fn(() => builder), single: jest.fn().mockResolvedValue({ data: { tz: 'Asia/Bishkek' }, error: null }) };
    jest.mocked(getServiceClient).mockReturnValue({
        from: jest.fn(() => builder),
        rpc: jest.fn().mockResolvedValue({ data: { revision: 1, timezone: 'Asia/Bishkek', today: '2026-11-26', days: [] }, error: null }),
    } as never);
});

describe('GET /api/staff/me/schedule (S3)', () => {
    test('the employee is resolved from the request, so the app\'s Bearer token and X-Kezek-Staff-Id work', async () => {
        jest.mocked(getStaffContextForRequest).mockResolvedValue({ staffId: STAFF, bizId: 'biz-1' } as never);
        const request = new Request('http://localhost/api/staff/me/schedule?from=2026-11-23&to=2026-12-06', {
            headers: { Authorization: 'Bearer app-token', 'X-Kezek-Staff-Id': STAFF },
        });
        const response = await scheduleHttp(request);
        expect(response.status).toBe(200);
        expect(getStaffContextForRequest).toHaveBeenCalledWith(request, 'ExplicitSchedule');
        expect(getBizContextForManagers).not.toHaveBeenCalled();
        expect(jest.mocked(getServiceClient).mock.results[0].value.rpc).toHaveBeenCalledWith('read_staff_schedule', {
            p_staff: STAFF, p_biz: 'biz-1', p_from: '2026-11-23', p_to: '2026-12-06',
        });
    });

    test('while the explicit model is off the endpoint answers 503 before any auth (the app falls back)', async () => {
        jest.mocked(explicitSchedulingEnabled).mockReturnValue(false);
        const response = await scheduleHttp(new Request('http://localhost/api/staff/me/schedule'));
        expect(response.status).toBe(503);
        expect(getStaffContextForRequest).not.toHaveBeenCalled();
    });
});
