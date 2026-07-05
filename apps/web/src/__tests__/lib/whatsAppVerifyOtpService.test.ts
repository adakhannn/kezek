import { verifyExistingWhatsAppOtp } from '@/lib/whatsAppVerifyOtpService';
import { createMockSupabase } from '../api/testHelpers';

describe('whatsAppVerifyOtpService', () => {
    test('verifies an OTP for an authenticated user', async () => {
        const supabase = createMockSupabase();
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
                    whatsapp_otp_phone: '+996555123456',
                },
            },
            code: '123456',
            findAuthOwnerByPhone: jest.fn().mockResolvedValue(null),
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
            findAuthOwnerByPhone: jest.fn().mockResolvedValue(null),
        });

        expect(result).toEqual({
            ok: false,
            error: 'validation',
            message: 'Неверный код. Попробуйте еще раз.',
            details: { code: 'wrong_code' },
            status: 400,
        });
    });

    test('rejects a WhatsApp identity owned by another auth user', async () => {
        const supabase = createMockSupabase();

        const result = await verifyExistingWhatsAppOtp({
            supabase,
            user: {
                id: 'current-user',
                user_metadata: {
                    whatsapp_otp_code: '123456',
                    whatsapp_otp_expires: new Date(Date.now() + 60_000).toISOString(),
                    whatsapp_otp_phone: '+996555123456',
                },
            },
            code: '123456',
            findAuthOwnerByPhone: jest.fn().mockResolvedValue('existing-whatsapp-user'),
        });

        expect(result).toEqual({
            ok: false,
            error: 'conflict',
            message: 'Этот WhatsApp номер уже используется другим аккаунтом. Войдите через него или обратитесь в поддержку.',
            details: { code: 'whatsapp_identity_already_linked' },
            status: 409,
        });
        expect(supabase.from).not.toHaveBeenCalled();
    });
});
