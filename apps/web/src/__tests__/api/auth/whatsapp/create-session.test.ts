import { POST } from '@/app/api/auth/whatsapp/create-session/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../../testHelpers';

setupApiTestMocks();

import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/senders/sms', () => ({
    normalizePhoneToE164: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, _config, handler) => handler()),
    RateLimitConfigs: {
        auth: {},
    },
}));

describe('/api/auth/whatsapp/create-session', () => {
    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();
        mockAdmin.auth.admin = {
            listUsers: jest.fn(),
            updateUserById: jest.fn(),
            createUser: jest.fn(),
            generateLink: jest.fn(),
            getUserById: jest.fn(),
        };
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    test('returns 400 when phone and userId are missing', async () => {
        const req = createMockRequest('http://localhost/api/auth/whatsapp/create-session', {
            method: 'POST',
            body: {},
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'validation');
    });

    test('returns 400 for invalid phone format', async () => {
        (normalizePhoneToE164 as jest.Mock).mockReturnValue(null);

        const req = createMockRequest('http://localhost/api/auth/whatsapp/create-session', {
            method: 'POST',
            body: { phone: 'invalid-phone' },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'validation');
    });

    test('creates session credentials by userId', async () => {
        const userId = '11111111-1111-4111-8111-111111111111';

        mockAdmin.auth.admin.getUserById.mockResolvedValue({
            data: { user: { id: userId, email: 'test@example.com', phone: '+996555123456' } },
            error: null,
        });
        mockAdmin.auth.admin.updateUserById.mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/auth/whatsapp/create-session', {
            method: 'POST',
            body: { userId },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data.email).toBe('test@example.com');
        expect(data.password).toEqual(expect.any(String));
        expect(data.needsSignIn).toBe(true);
        expect(mockAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(
            userId,
            expect.objectContaining({ password: expect.any(String) }),
        );
    });

    test('creates session credentials by phone', async () => {
        const userId = '22222222-2222-4222-8222-222222222222';
        const phoneE164 = '+996555123456';

        (normalizePhoneToE164 as jest.Mock).mockReturnValue(phoneE164);
        mockAdmin.auth.admin.listUsers.mockResolvedValue({
            data: {
                users: [{ id: userId, phone: phoneE164, email: null, user_metadata: {} }],
            },
            error: null,
        });
        mockAdmin.auth.admin.updateUserById.mockResolvedValue({
            data: { user: { id: userId } },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/auth/whatsapp/create-session', {
            method: 'POST',
            body: { phone: phoneE164 },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data.email).toBe('996555123456@whatsapp.kezek.kg');
        expect(data.password).toEqual(expect.any(String));
        expect(mockAdmin.auth.admin.updateUserById).toHaveBeenNthCalledWith(
            1,
            userId,
            expect.objectContaining({ email: '996555123456@whatsapp.kezek.kg', email_confirm: true }),
        );
        expect(mockAdmin.auth.admin.updateUserById).toHaveBeenNthCalledWith(
            2,
            userId,
            expect.objectContaining({ password: expect.any(String) }),
        );
    });

    test('returns 404 when user is not found by phone', async () => {
        (normalizePhoneToE164 as jest.Mock).mockReturnValue('+996555123456');
        mockAdmin.auth.admin.listUsers.mockResolvedValue({
            data: { users: [] },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/auth/whatsapp/create-session', {
            method: 'POST',
            body: { phone: '+996555123456' },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 404, 'user_not_found');
    });
});
