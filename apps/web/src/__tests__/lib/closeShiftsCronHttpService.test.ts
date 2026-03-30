jest.mock('@/lib/closeShiftsCronService', () => ({
    runCloseShiftsCron: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

import { runCloseShiftsCron } from '@/lib/closeShiftsCronService';
import { getServiceClient } from '@/lib/supabaseService';

describe('closeShiftsCronHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn(), rpc: jest.fn() });
    });

    test('returns auth error for invalid secret', async () => {
        const { runCloseShiftsCronHttp } = await import('@/lib/closeShiftsCronHttpService');

        const response = await runCloseShiftsCronHttp(
            new Request('http://localhost/api/cron/close-shifts'),
            'test-secret',
        );
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('auth');
    });

    test('delegates to close shifts service for authorized request', async () => {
        (runCloseShiftsCron as jest.Mock).mockResolvedValue({
            ok: true,
            data: { ok: true, message: 'done', closed: 1, total: 2 },
        });
        const { runCloseShiftsCronHttp } = await import('@/lib/closeShiftsCronHttpService');

        const response = await runCloseShiftsCronHttp(
            new Request('http://localhost/api/cron/close-shifts', {
                headers: { authorization: 'Bearer test-secret' },
            }),
            'test-secret',
        );
        const body = await response.json();

        expect(runCloseShiftsCron).toHaveBeenCalledWith({
            supabase: expect.any(Object),
        });
        expect(response.status).toBe(200);
        expect(body.data.closed).toBe(1);
    });
});
