import { createWhatsAppSignInSession } from '@/lib/whatsAppCreateSessionService';
import { createMockSupabase } from '../api/testHelpers';

describe('whatsAppCreateSessionService', () => {
    test('creates session credentials by userId', async () => {
        const admin = createMockSupabase();
        (admin as unknown as { auth: { admin: any } }).auth.admin = {
            getUserById: jest.fn().mockResolvedValue({
                data: { user: { id: 'user-id', email: 'test@example.com', phone: '+996555123456' } },
                error: null,
            }),
            listUsers: jest.fn(),
            updateUserById: jest.fn().mockResolvedValue({
                data: { user: { id: 'user-id' } },
                error: null,
            }),
        };

        const result = await createWhatsAppSignInSession({
            admin: admin as never,
            userId: 'user-id',
            randomHex: () => 'temp-password',
        });

        expect(result).toEqual({
            ok: true,
            data: {
                email: 'test@example.com',
                password: 'temp-password',
                needsSignIn: true,
            },
        });
    });

    test('creates temp email for phone-only user', async () => {
        const admin = createMockSupabase();
        const updateUserById = jest.fn().mockResolvedValue({
            data: { user: { id: 'user-id' } },
            error: null,
        });
        (admin as unknown as { auth: { admin: any } }).auth.admin = {
            getUserById: jest.fn(),
            listUsers: jest.fn().mockResolvedValue({
                data: {
                    users: [{ id: 'user-id', email: null, phone: '+996555123456', user_metadata: {} }],
                },
                error: null,
            }),
            updateUserById,
        };

        const result = await createWhatsAppSignInSession({
            admin: admin as never,
            phoneE164: '+996555123456',
            randomHex: () => 'temp-password',
        });

        expect(result).toEqual({
            ok: true,
            data: {
                email: '996555123456@whatsapp.kezek.kg',
                password: 'temp-password',
                needsSignIn: true,
            },
        });
        expect(updateUserById).toHaveBeenNthCalledWith(
            1,
            'user-id',
            expect.objectContaining({ email: '996555123456@whatsapp.kezek.kg', email_confirm: true }),
        );
        expect(updateUserById).toHaveBeenNthCalledWith(
            2,
            'user-id',
            expect.objectContaining({ password: 'temp-password' }),
        );
    });
});
