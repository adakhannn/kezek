import { runWhatsAppDiagnoseRoute } from '@/lib/whatsAppDiagnoseRouteService';

jest.mock('@/lib/whatsAppDiagnoseService', () => ({
    diagnoseWhatsAppSetup: jest.fn(),
}));

import { diagnoseWhatsAppSetup } from '@/lib/whatsAppDiagnoseService';

describe('whatsAppDiagnoseRouteService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns internal error when token is missing', async () => {
        const result = await runWhatsAppDiagnoseRoute({
            env: {},
        });

        expect(result).toEqual({
            ok: false,
            status: 500,
            error: 'internal',
            message: 'WHATSAPP_ACCESS_TOKEN не установлен',
            details: { code: 'no_token' },
        });
    });

    test('delegates to diagnose service when token exists', async () => {
        (diagnoseWhatsAppSetup as jest.Mock).mockResolvedValue({
            summary: { tokenValid: true },
        });

        const result = await runWhatsAppDiagnoseRoute({
            env: {
                WHATSAPP_ACCESS_TOKEN: 'test-token',
                WHATSAPP_PHONE_NUMBER_ID: '123456789',
            },
        });

        expect(diagnoseWhatsAppSetup).toHaveBeenCalledWith({
            accessToken: 'test-token',
            phoneNumberId: '123456789',
        });
        expect(result).toEqual({
            ok: true,
            payload: {
                summary: { tokenValid: true },
            },
        });
    });
});
