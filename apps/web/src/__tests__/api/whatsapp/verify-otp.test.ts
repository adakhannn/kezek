/**
 * Тесты для /api/whatsapp/verify-otp
 * Проверка OTP кода и подтверждение WhatsApp номера.
 * Код хранится только как HMAC в app_metadata (пишет только service role).
 */

import { POST } from '@/app/api/whatsapp/verify-otp/route';
import { hashWhatsappOtp } from '@/lib/whatsAppOtpHash';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

// Мокаем зависимости
jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    routeRateLimit: jest.requireActual('@/lib/rateLimit').routeRateLimit,
    withRateLimit: jest.fn((req, config, handler) => handler()),
    RateLimitConfigs: {
        auth: {},
    },
}));

type StoredOtp = { codeHash: string; phone: string; expiresAt: string; attempts: number } | undefined;

describe('/api/whatsapp/verify-otp', () => {
    const mockSupabase = createMockSupabase();
    let storedOtp: StoredOtp;
    let profileUpdate: jest.Mock;
    let updateUserById: jest.Mock;

    function storeOtp(code: string, expiresInMs = 600000, attempts = 0) {
        storedOtp = {
            codeHash: hashWhatsappOtp(code),
            phone: '+996555123456',
            expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
            attempts,
        };
    }

    function signIn(userMetadata: Record<string, unknown> = {}) {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-id', user_metadata: userMetadata } },
            error: null,
        });
    }

    async function verify(code: string) {
        return POST(createMockRequest('http://localhost/api/whatsapp/verify-otp', {
            method: 'POST',
            body: { code },
        }));
    }

    beforeEach(() => {
        jest.clearAllMocks();
        storedOtp = undefined;
        profileUpdate = jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ data: null, error: null }) }));
        updateUserById = jest.fn(async (_id: string, payload: { app_metadata: { whatsapp_link_otp: StoredOtp | null } }) => {
            storedOtp = payload.app_metadata.whatsapp_link_otp ?? undefined;
            return { data: {}, error: null };
        });

        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
        (createSupabaseAdminClient as jest.Mock).mockReturnValue({
            auth: {
                admin: {
                    getUserById: jest.fn(async (id: string) => ({
                        data: { user: { id, app_metadata: storedOtp ? { whatsapp_link_otp: storedOtp } : {} } },
                        error: null,
                    })),
                    updateUserById,
                },
            },
            // Owner lookup by a confirmed Auth phone (find_accounts_by_contact): no other owner.
            rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
            from: jest.fn(() => {
                const lookup = {
                    eq: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                };
                return { select: jest.fn().mockReturnValue(lookup), update: profileUpdate };
            }),
        });
    });

    describe('Авторизация', () => {
        test('должен вернуть 401 если пользователь не авторизован', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

            await expectErrorResponse(await verify('123456'), 401);
        });
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при неверном формате кода', async () => {
            signIn();

            await expectErrorResponse(await verify('12345'), 400, 'invalid_code');
        });

        test('должен вернуть 400 если код не найден', async () => {
            signIn();

            await expectErrorResponse(await verify('123456'), 400, 'no_code');
        });

        test('не принимает код, подложенный в редактируемые пользователем метаданные', async () => {
            signIn({
                whatsapp_otp_code: '123456',
                whatsapp_otp_expires: new Date(Date.now() + 600000).toISOString(),
                whatsapp_otp_phone: '+996555123456',
            });

            await expectErrorResponse(await verify('123456'), 400, 'no_code');
            expect(profileUpdate).not.toHaveBeenCalled();
        });

        test('должен вернуть 400 если код истек', async () => {
            signIn();
            storeOtp('123456', -60000);

            await expectErrorResponse(await verify('123456'), 400, 'expired');
        });

        test('должен вернуть 400 если код неверный и учесть попытку', async () => {
            signIn();
            storeOtp('123456');

            await expectErrorResponse(await verify('999999'), 400, 'wrong_code');
            expect(storedOtp?.attempts).toBe(1);
        });

        test('блокирует код после исчерпания попыток', async () => {
            signIn();
            storeOtp('123456', 600000, 5);

            await expectErrorResponse(await verify('123456'), 429, 'rate_limit');
            expect(profileUpdate).not.toHaveBeenCalled();
        });
    });

    describe('Успешная проверка', () => {
        test('должен успешно подтвердить WhatsApp номер через service-клиент', async () => {
            signIn();
            storeOtp('123456');

            const data = await expectSuccessResponse(await verify('123456'), 200);

            expect(data).toHaveProperty('ok', true);
            expect(profileUpdate).toHaveBeenCalledWith({ whatsapp_phone: '+996555123456', whatsapp_verified: true });
            expect(mockSupabase.from).not.toHaveBeenCalledWith('profiles');
            expect(storedOtp).toBeUndefined();
        });
    });
});
