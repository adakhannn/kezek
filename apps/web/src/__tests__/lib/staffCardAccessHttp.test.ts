jest.mock('@/lib/rateLimit', () => ({ ...jest.requireActual('@/lib/rateLimit'), checkVerifiedPrincipalRateLimit: jest.fn(async () => ({ success: true })) }));

import { handleApiError } from '@/lib/apiErrorHandler';
import { BizAccessError, StaffSelectionRequiredError } from '@/lib/authDiagnostics';
import { runStaffFinanceHttp } from '@/lib/staffFinanceHttpService';
import { runStaffFinanceStatsHttp } from '@/lib/staffFinanceStatsHttpService';
import { runStaffShiftCloseHttp } from '@/lib/staffShiftCloseHttpService';
import { runStaffShiftItemsHttp } from '@/lib/staffShiftItemsHttpService';
import { runStaffShiftOpenHttp } from '@/lib/staffShiftOpenHttpService';

jest.mock('@/lib/authBiz', () => ({ getStaffContextForRequest: jest.fn() }));
jest.mock('@/lib/staffShiftOpenService', () => ({ runOpenStaffShift: jest.fn() }));
jest.mock('@/lib/staffShiftCloseService', () => ({ runStaffShiftClose: jest.fn() }));
jest.mock('@/lib/staffShiftItemsRouteService', () => ({ runStaffShiftItemsRoute: jest.fn() }));
jest.mock('@/lib/staffFinanceRouteService', () => ({ runStaffFinanceRoute: jest.fn() }));
jest.mock('@/lib/staffFinanceStatsService', () => ({ runStaffFinanceStats: jest.fn() }));
jest.mock('@/lib/withManagerAndStaffContext', () => ({ withManagerAndStaffContext: jest.fn() }));
jest.mock('@/lib/routeParams', () => ({ getRouteParamUuid: jest.fn() }));
jest.mock('@/lib/apiMetrics', () => ({
    determineErrorType: jest.fn(() => 'auth'),
    getIpAddress: jest.fn(() => '127.0.0.1'),
    logApiMetric: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));

const { getStaffContextForRequest } = jest.requireMock('@/lib/authBiz');
const { runOpenStaffShift } = jest.requireMock('@/lib/staffShiftOpenService');
const { runStaffShiftClose } = jest.requireMock('@/lib/staffShiftCloseService');
const { runStaffShiftItemsRoute } = jest.requireMock('@/lib/staffShiftItemsRouteService');
const { runStaffFinanceRoute } = jest.requireMock('@/lib/staffFinanceRouteService');
const { runStaffFinanceStats } = jest.requireMock('@/lib/staffFinanceStatsService');
const { getRouteParamUuid } = jest.requireMock('@/lib/routeParams');
const { logApiMetric } = jest.requireMock('@/lib/apiMetrics');
const { logError } = jest.requireMock('@/lib/log');

const STAFF_A = '11111111-1111-4111-8111-111111111111';
const STAFF_B = '22222222-2222-4222-8222-222222222222';
const options = [
    { staffId: STAFF_A, bizId: 'biz-a', branchId: 'branch-a' },
    { staffId: STAFF_B, bizId: 'biz-b', branchId: null },
];

const post = (path: string, body?: unknown) =>
    new Request(`http://localhost${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: 'Bearer token' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

// Each staff endpoint, with the place where the staff card is resolved made to throw.
const endpoints: Array<{ name: string; call: () => Promise<Response>; throwFrom: (error: Error) => void; service: jest.Mock }> = [
    {
        name: 'POST /api/staff/shift/open',
        call: () => runStaffShiftOpenHttp(post('/api/staff/shift/open')),
        throwFrom: (error) => getStaffContextForRequest.mockRejectedValue(error),
        service: runOpenStaffShift,
    },
    {
        name: 'POST /api/staff/shift/close',
        call: () => runStaffShiftCloseHttp(post('/api/staff/shift/close', { items: [] })),
        throwFrom: (error) => getStaffContextForRequest.mockRejectedValue(error),
        service: runStaffShiftClose,
    },
    {
        name: 'POST /api/staff/shift/items',
        call: () => runStaffShiftItemsHttp(post('/api/staff/shift/items', { items: [] })),
        throwFrom: (error) => runStaffShiftItemsRoute.mockRejectedValue(error),
        service: runStaffShiftItemsRoute,
    },
    {
        name: 'GET /api/staff/finance',
        call: () => runStaffFinanceHttp(new Request('http://localhost/api/staff/finance', { headers: { authorization: 'Bearer token' } })),
        throwFrom: (error) => runStaffFinanceRoute.mockRejectedValue(error),
        service: runStaffFinanceRoute,
    },
];

describe('staff card refusals are ordinary answers (ARCH-02)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getStaffContextForRequest.mockReset();
        runStaffShiftItemsRoute.mockReset();
        runStaffFinanceRoute.mockReset();
    });

    describe.each(endpoints)('$name', ({ call, throwFrom, service }) => {
        test('a master of several businesses without a chosen card gets 400 STAFF_SELECTION_REQUIRED with the cards', async () => {
            throwFrom(new StaffSelectionRequiredError(options));

            const response = await call();
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body).toMatchObject({
                ok: false,
                error: 'validation',
                details: { code: 'STAFF_SELECTION_REQUIRED', options: [{ staffId: STAFF_A, bizId: 'biz-a' }, { staffId: STAFF_B, bizId: 'biz-b' }] },
            });
            expect(logApiMetric).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
            expect(logError).not.toHaveBeenCalled();
            if (service !== runStaffShiftItemsRoute && service !== runStaffFinanceRoute) expect(service).not.toHaveBeenCalled();
        });

        test.each(['NO_STAFF_RECORD', 'NO_STAFF_ACCESS'] as const)('%s is 403, not 401 or 500', async (code) => {
            throwFrom(new BizAccessError(code));

            const response = await call();
            const body = await response.json();

            expect(response.status).toBe(403);
            expect(body).toMatchObject({ ok: false, error: 'forbidden', details: { code } });
            expect(logApiMetric).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        });
    });

    test('finance stats (mobile): the route names the card, refusals are 400/403', async () => {
        getRouteParamUuid.mockResolvedValue(STAFF_B);
        getStaffContextForRequest.mockRejectedValueOnce(new BizAccessError('NO_STAFF_ACCESS'));
        const request = new Request(`http://localhost/api/dashboard/staff/${STAFF_B}/finance/stats`, {
            headers: { authorization: 'Bearer token' },
        });

        const response = await runStaffFinanceStatsHttp(request, { params: { id: STAFF_B } });

        expect(response.status).toBe(403);
        expect(getStaffContextForRequest).toHaveBeenCalledWith(request, 'StaffFinanceStats', { staffId: STAFF_B });
        expect(runStaffFinanceStats).not.toHaveBeenCalled();
    });

    test('routes behind withErrorHandler get the same answers', async () => {
        const selection = handleApiError(new StaffSelectionRequiredError(options), 'StaffAvatarUpload');
        expect(selection.status).toBe(400);
        await expect(selection.json()).resolves.toMatchObject({ details: { code: 'STAFF_SELECTION_REQUIRED' } });

        const noRecord = handleApiError(new BizAccessError('NO_STAFF_RECORD'), 'StaffShiftToday');
        expect(noRecord.status).toBe(403);

        // Unrelated errors keep their old classification.
        expect(handleApiError(new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED'), 'X').status).toBe(401);
        expect(handleApiError(new Error('boom'), 'X').status).toBe(500);
    });
});
