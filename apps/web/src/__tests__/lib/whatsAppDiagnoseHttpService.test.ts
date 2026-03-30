jest.mock('@/lib/whatsAppDiagnoseRouteService', () => ({
    runWhatsAppDiagnoseRoute: jest.fn(),
}));

import { runWhatsAppDiagnoseHttp } from '@/lib/whatsAppDiagnoseHttpService';
import { runWhatsAppDiagnoseRoute } from '@/lib/whatsAppDiagnoseRouteService';

describe('whatsAppDiagnoseHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates success result to api response', async () => {
        (runWhatsAppDiagnoseRoute as jest.Mock).mockResolvedValue({
            ok: true,
            payload: { ok: true, checks: [] },
        });

        const response = await runWhatsAppDiagnoseHttp();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.ok).toBe(true);
    });

    test('maps internal errors to api response', async () => {
        (runWhatsAppDiagnoseRoute as jest.Mock).mockResolvedValue({
            ok: false,
            error: 'internal',
            message: 'WHATSAPP_ACCESS_TOKEN missing',
            details: { code: 'no_token' },
            status: 500,
        });

        const response = await runWhatsAppDiagnoseHttp();
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error).toBe('internal');
    });
});
