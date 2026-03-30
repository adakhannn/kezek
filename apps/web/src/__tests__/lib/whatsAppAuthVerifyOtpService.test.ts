import { verifyWhatsAppOtpLogin } from '@/lib/whatsAppAuthVerifyOtpService';
import { createMockSupabase } from '../api/testHelpers';

describe('whatsAppAuthVerifyOtpService', () => {
    test('logs in an existing user with valid OTP table record', async () => {
        const admin = createMockSupabase();
        const listUsers = jest.fn().mockResolvedValue({
            data: {
                users: [{ id: 'user-id', phone: '+996555123456', user_metadata: {} }],
            },
            error: null,
        });

        (admin as unknown as { auth: { admin: { listUsers: jest.Mock } } }).auth.admin.listUsers = listUsers;

        admin.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            gt: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'otp-id' },
                error: null,
            }),
        });

        admin.from.mockReturnValueOnce({
            update: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        admin.from.mockReturnValueOnce({
            upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
        });

        const result = await verifyWhatsAppOtpLogin({
            admin,
            phoneE164: '+996555123456',
            code: '123456',
        });

        expect(result).toEqual({
            ok: true,
            data: {
                message: 'Вход выполнен успешно',
                userId: 'user-id',
                phone: '+996555123456',
                isNewUser: false,
            },
        });
    });

    test('returns validation error for missing valid OTP', async () => {
        const admin = createMockSupabase();
        (admin as unknown as { auth: { admin: { listUsers: jest.Mock } } }).auth.admin.listUsers = jest.fn().mockResolvedValue({
            data: { users: [] },
            error: null,
        });

        admin.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            gt: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        });

        const result = await verifyWhatsAppOtpLogin({
            admin,
            phoneE164: '+996555123456',
            code: '123456',
        });

        expect(result).toEqual({
            ok: false,
            error: 'validation',
            message: 'Неверный или истекший код. Запросите новый код.',
            details: { code: 'invalid_code' },
            status: 400,
        });
    });
});
