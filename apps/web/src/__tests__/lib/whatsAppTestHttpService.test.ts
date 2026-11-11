jest.mock('@/lib/adminHttpAccess', () => ({ requireCurrentSuperAdmin: jest.fn(async () => ({ ok: true, user: { id: 'test-super-admin' } })) }));
jest.mock('@/lib/whatsAppTestService', () => ({
    getWhatsAppTestSnapshot: jest.fn(),
}));

import { getWhatsAppTestSnapshot } from '@/lib/whatsAppTestService';

describe('whatsAppTestHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns success response with test snapshot', async () => {
        (getWhatsAppTestSnapshot as jest.Mock).mockReturnValue({
            configured: true,
            details: {},
            message: 'configured',
        });
        const { runWhatsAppTestHttp } = await import('@/lib/whatsAppTestHttpService');

        const response = await runWhatsAppTestHttp({} as NodeJS.ProcessEnv);
        const body = await response.json();

        expect(getWhatsAppTestSnapshot).toHaveBeenCalled();
        expect(response.status).toBe(200);
        expect(body.data.configured).toBe(true);
    });
});
