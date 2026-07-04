import { verifyExistingWhatsAppOtp } from '@/lib/whatsAppVerifyOtpService';
import { createMockSupabase } from '../api/testHelpers';

describe('whatsAppVerifyOtpService', () => {
    test('verifies an OTP for an authenticated user', async () => {
        const supabase = createMockSupabase();
        supabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { phone: '+996555123456' },
                error: null,
            }),
        });
        supabase.from.mockReturnValueOnce({
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        });
        supabase.auth.updateUser.mockResolvedValue({
            data: { user: { id: 'user-id' } },
            error: null,
        });

        const result = await verifyExistingWhatsAppOtp({
            supabase,
            user: {
                id: 'user-id',
                user_metadata: {
                    whatsapp_otp_code: '123456',
                    whatsapp_otp_expires: new Date(Date.now() + 60_000).toISOString(),
                },
            },
            code: '123456',
        });

        expect(result).toEqual({
            ok: true,
            data: {
                message: 'WhatsApp номер подтвержден',
            },
        });
    });

    test('rejects wrong OTP code', async () => {
        const supabase = createMockSupabase();

        const result = await verifyExistingWhatsAppOtp({
            supabase,
            user: {
                id: 'user-id',
                user_metadata: {
                    whatsapp_otp_code: '123456',
                    whatsapp_otp_expires: new Date(Date.now() + 60_000).toISOString(),
                },
            },
            code: '999999',
        });

        expect(result).toEqual({
            ok: false,
            error: 'validation',
            message: 'Неверный код. Попробуйте еще раз.',
            details: { code: 'wrong_code' },
            status: 400,
        });
    });
});
