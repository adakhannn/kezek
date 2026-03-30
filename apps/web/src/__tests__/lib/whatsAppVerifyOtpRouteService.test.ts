import { runWhatsAppVerifyOtpRoute } from '@/lib/whatsAppVerifyOtpRouteService';

jest.mock('@/lib/whatsAppVerifyOtpService', () => ({
    verifyExistingWhatsAppOtp: jest.fn(),
}));

import { verifyExistingWhatsAppOtp } from '@/lib/whatsAppVerifyOtpService';

describe('whatsAppVerifyOtpRouteService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns auth error when user is missing', async () => {
        const supabase = {
            auth: {
                getUser: jest.fn().mockResolvedValue({
                    data: { user: null },
                }),
            },
        };

        const result = await runWhatsAppVerifyOtpRoute({
            supabase: supabase as never,
            code: '123456',
        });

        expect(result).toEqual({
            ok: false,
            error: 'auth',
            message: 'Не авторизован',
            status: 401,
        });
    });

    test('delegates verification for authenticated user', async () => {
        const user = { id: 'user-1', user_metadata: {} };
        const supabase = {
            auth: {
                getUser: jest.fn().mockResolvedValue({
                    data: { user },
                }),
            },
        };
        (verifyExistingWhatsAppOtp as jest.Mock).mockResolvedValue({
            ok: true,
            data: { message: 'WhatsApp номер подтвержден' },
        });

        const result = await runWhatsAppVerifyOtpRoute({
            supabase: supabase as never,
            code: '123456',
        });

        expect(verifyExistingWhatsAppOtp).toHaveBeenCalledWith({
            supabase,
            user,
            code: '123456',
        });
        expect(result).toEqual({
            ok: true,
            data: { message: 'WhatsApp номер подтвержден' },
        });
    });
});
