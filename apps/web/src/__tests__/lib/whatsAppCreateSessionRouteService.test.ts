import { runWhatsAppCreateSessionRoute } from '@/lib/whatsAppCreateSessionRouteService';

jest.mock('@/lib/senders/sms', () => ({
    normalizePhoneToE164: jest.fn(),
}));

jest.mock('@/lib/whatsAppCreateSessionService', () => ({
    createWhatsAppSignInSession: jest.fn(),
}));

import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { createWhatsAppSignInSession } from '@/lib/whatsAppCreateSessionService';

describe('whatsAppCreateSessionRouteService', () => {
    const admin = { auth: { admin: {} } };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns validation error for invalid phone format', async () => {
        (normalizePhoneToE164 as jest.Mock).mockReturnValue(null);

        const result = await runWhatsAppCreateSessionRoute({
            admin: admin as never,
            phone: 'invalid-phone',
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Неверный формат номера телефона',
            details: { code: 'invalid_phone' },
        });
    });

    test('delegates normalized phone to create session service', async () => {
        (normalizePhoneToE164 as jest.Mock).mockReturnValue('+996555123456');
        (createWhatsAppSignInSession as jest.Mock).mockResolvedValue({
            ok: true,
            data: {
                email: '996555123456@whatsapp.kezek.kg',
                password: 'secret',
                needsSignIn: true,
            },
        });

        const result = await runWhatsAppCreateSessionRoute({
            admin: admin as never,
            phone: '+996555123456',
        });

        expect(createWhatsAppSignInSession).toHaveBeenCalledWith({
            admin,
            userId: undefined,
            phoneE164: '+996555123456',
        });
        expect(result).toEqual({
            ok: true,
            payload: {
                email: '996555123456@whatsapp.kezek.kg',
                password: 'secret',
                needsSignIn: true,
            },
        });
    });
});
