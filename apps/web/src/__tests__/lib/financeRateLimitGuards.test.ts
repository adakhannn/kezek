jest.mock('@/lib/rateLimit', () => ({ ...jest.requireActual('@/lib/rateLimit'), checkVerifiedPrincipalRateLimit: jest.fn() }));
jest.mock('@/lib/authBiz', () => ({ getStaffContextForRequest: jest.fn(), getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/withManagerContext', () => ({ withManagerContext: jest.fn() }));
jest.mock('@/lib/staffShiftOpenService', () => ({ runOpenStaffShift: jest.fn() }));
jest.mock('@/lib/staffShiftCloseService', () => ({ runStaffShiftClose: jest.fn() }));
jest.mock('@/lib/staffShiftItemsService', () => ({ runSaveStaffShiftItems: jest.fn() }));
jest.mock('@/lib/dashboardStaffShiftCloseService', () => ({ runDashboardStaffShiftClose: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/routeParams', () => ({ getRouteParamUuid: jest.fn(async () => 'staff-1') }));
jest.mock('@/lib/validation/apiValidation', () => ({ validateRequest: jest.fn() }));
jest.mock('@/lib/apiMetrics', () => ({ logApiMetric: jest.fn(async () => {}), getIpAddress: jest.fn(), determineErrorType: jest.fn() }));

import { checkVerifiedPrincipalRateLimit } from '@/lib/rateLimit';
import { getStaffContextForRequest, getBizContextForManagers } from '@/lib/authBiz';
import { withManagerContext } from '@/lib/withManagerContext';
import { validateRequest } from '@/lib/validation/apiValidation';
import { runStaffShiftOpenHttp } from '@/lib/staffShiftOpenHttpService';
import { runStaffShiftCloseHttp } from '@/lib/staffShiftCloseHttpService';
import { runStaffShiftItemsHttp } from '@/lib/staffShiftItemsHttpService';
import { runDashboardStaffShiftCloseHttp } from '@/lib/dashboardStaffShiftCloseHttpService';
import { runOpenStaffShift } from '@/lib/staffShiftOpenService';
import { runStaffShiftClose } from '@/lib/staffShiftCloseService';
import { runSaveStaffShiftItems } from '@/lib/staffShiftItemsService';
import { runDashboardStaffShiftClose } from '@/lib/dashboardStaffShiftCloseService';

const supabase = { auth: { getUser: jest.fn() } };
const commands = [runOpenStaffShift, runStaffShiftClose, runSaveStaffShiftItems, runDashboardStaffShiftClose];
const operations = [
    ['/api/staff/shift/open', runStaffShiftOpenHttp],
    ['/api/staff/shift/close', runStaffShiftCloseHttp],
    ['/api/staff/shift/items', runStaffShiftItemsHttp],
    ['/api/dashboard/staff/[id]/shift/close', (req: Request) => runDashboardStaffShiftCloseHttp(req, {})],
] as const;
beforeEach(() => {
    jest.clearAllMocks();
    (getStaffContextForRequest as jest.Mock).mockResolvedValue({ supabase, userId: 'verified-user', bizId: 'verified-business', staffId: 'staff-1' });
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ supabase, bizId: 'verified-business' });
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null });
    (withManagerContext as jest.Mock).mockImplementation(async (_req, _scope, handler) => handler({
        admin: supabase, userId: 'verified-user', bizId: 'verified-business',
    }));
    (validateRequest as jest.Mock).mockResolvedValue({ success: true, data: {
        expectedShiftId: 'shift-1', expectedRevision: 2, items: [], totalAmount: 0,
    } });
});

describe.each(operations)('%s', (route, run) => {
    test.each([false, true])('denies before financial commands when unavailable=%s', async unavailable => {
        (checkVerifiedPrincipalRateLimit as jest.Mock).mockResolvedValue({ success: false, unavailable,
            limit: 5, remaining: 0, reset: 60000, retryAfter: 12 });
        const request = new Request('https://example.com' + route, { method: 'POST', headers: {
            authorization: 'Bearer unverified-claims', 'x-user-id': 'forged-user', 'x-business-id': 'forged-business',
        } });
        const response = await run(request);
        expect(response.status).toBe(unavailable ? 503 : 429);
        expect(response.headers.get('Retry-After')).toBe('12');
        expect(checkVerifiedPrincipalRateLimit).toHaveBeenCalledWith(request, route,
            { userId: 'verified-user', bizId: 'verified-business' }, expect.any(Object));
        for (const command of commands) expect(command).not.toHaveBeenCalled();
    });
});

test('failed authentication never spends an attacker-supplied principal or invokes a command', async () => {
    (getStaffContextForRequest as jest.Mock).mockRejectedValue(new Error('UNAUTHORIZED'));
    const response = await runStaffShiftOpenHttp(new Request('https://example.com/api/staff/shift/open', {
        method: 'POST', headers: { authorization: 'Bearer forged', 'x-user-id': 'victim' },
    }));
    expect(response.status).toBe(401);
    expect(checkVerifiedPrincipalRateLimit).not.toHaveBeenCalled();
    for (const command of commands) expect(command).not.toHaveBeenCalled();
});

test('manager auth.error with a stale user fails before principal guard or mutation', async () => {
    (validateRequest as jest.Mock).mockResolvedValue({ success: true, data: { staffId: 'target', items: [], expectedShiftId: 'shift', expectedRevision: 2 } });
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'stale-user' } }, error: new Error('invalid session') });
    const response = await runStaffShiftItemsHttp(new Request('https://example.com/api/staff/shift/items', { method: 'POST' }));
    expect(response.status).toBe(401);
    expect(checkVerifiedPrincipalRateLimit).not.toHaveBeenCalled();
    for (const command of commands) expect(command).not.toHaveBeenCalled();
});
