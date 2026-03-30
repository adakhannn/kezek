import { GET } from '@/app/api/cron/close-shifts/route';
import { expectErrorResponse, expectSuccessResponse } from '../testHelpers';

jest.mock('@/lib/closeShiftsCronHttpService', () => ({
    runCloseShiftsCronHttp: jest.fn(),
}));

const { runCloseShiftsCronHttp } = require('@/lib/closeShiftsCronHttpService');

describe('/api/cron/close-shifts', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates GET to cron http service', async () => {
        runCloseShiftsCronHttp.mockResolvedValue(
            Response.json({
                ok: true,
                data: { ok: true, message: 'done', closed: 1, total: 1 },
            }),
        );

        const res = await GET(
            new Request('http://localhost/api/cron/close-shifts', {
                headers: { authorization: 'Bearer secret' },
            }),
        );
        const data = await expectSuccessResponse(res);

        expect(data.data.closed).toBe(1);
    });

    test('surfaces auth error from cron http service', async () => {
        runCloseShiftsCronHttp.mockResolvedValue(
            Response.json({ ok: false, error: 'auth', message: 'Не авторизован' }, { status: 401 }),
        );

        const res = await GET(
            new Request('http://localhost/api/cron/close-shifts', {
                headers: { authorization: 'Bearer wrong' },
            }),
        );
        const data = await expectErrorResponse(res, 401, 'auth');

        expect(data.message).toBe('Не авторизован');
    });
});
