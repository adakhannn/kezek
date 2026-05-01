jest.mock('@/lib/senders/whatsapp', () => ({
    sendWhatsApp: jest.fn(),
}));

jest.mock('@/lib/whatsAppCreateSessionService', () => ({
    createWhatsAppSignInSession: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';

import { GET as mobileExchangeGET } from '@/app/api/auth/mobile-exchange/route';
import { __resetMobileExchangeStoreForTests } from '@/lib/mobileExchangeService';
import { runWhatsAppMobileStartRoute } from '@/lib/whatsAppMobileStartRouteService';
import { runWhatsAppMobileVerifyRoute } from '@/lib/whatsAppMobileVerifyRouteService';
import { createWhatsAppSignInSession } from '@/lib/whatsAppCreateSessionService';
import { sendWhatsApp } from '@/lib/senders/whatsapp';
import { createMockNextRequest, expectSuccessResponse } from '../api/testHelpers';

type AttemptRow = {
    id: string;
    phone: string;
    phone_hash: string | null;
    otp_hash: string | null;
    code: string | null;
    status: string | null;
    expires_at: string;
    used_at: string | null;
    consumed_at: string | null;
    failed_attempts: number;
    locked_until: string | null;
    phone_masked?: string | null;
};

function createInMemoryAdmin() {
    const attempts: AttemptRow[] = [];
    const profiles = new Map<string, { id: string; phone: string; whatsapp_verified: boolean }>();
    const users: Array<{ id: string; phone: string; user_metadata?: Record<string, unknown> }> = [];
    let seq = 1;

    const admin = {
        auth: {
            admin: {
                listUsers: jest.fn(async () => ({ data: { users } })),
                updateUserById: jest.fn(),
                getUserById: jest.fn(),
                createUser: jest.fn(async (payload: { phone: string; user_metadata?: Record<string, unknown> }) => {
                    const user = {
                        id: `user-${users.length + 1}`,
                        phone: payload.phone,
                        user_metadata: payload.user_metadata ?? {},
                    };
                    users.push(user);
                    return { data: { user }, error: null };
                }),
            },
        },
        from: jest.fn((table: string) => {
            if (table === 'whatsapp_otp_codes') {
                const state: { id?: string; requireUsedAtNull?: boolean } = {};
                return {
                    insert(payload: Omit<AttemptRow, 'id'>) {
                        const row: AttemptRow = {
                            id: `attempt-${seq++}`,
                            ...payload,
                        };
                        attempts.push(row);
                        return {
                            select() {
                                return {
                                    single: async () => ({
                                        data: { id: row.id, expires_at: row.expires_at },
                                        error: null,
                                    }),
                                };
                            },
                        };
                    },
                    select() {
                        return {
                            eq(field: string, value: string) {
                                if (field === 'id') state.id = value;
                                return this;
                            },
                            maybeSingle: async () => ({
                                data: attempts.find((it) => it.id === state.id) ?? null,
                                error: null,
                            }),
                        };
                    },
                    update(patch: Partial<AttemptRow>) {
                        return {
                            eq(field: string, value: string) {
                                if (field === 'id') state.id = value;
                                const row = attempts.find((it) => it.id === state.id);
                                if (row && (!state.requireUsedAtNull || row.used_at == null)) {
                                    Object.assign(row, patch);
                                }
                                return this;
                            },
                            is(field: string, value: unknown) {
                                if (field === 'used_at' && value === null) {
                                    state.requireUsedAtNull = true;
                                }
                                return this;
                            },
                        };
                    },
                };
            }

            if (table === 'profiles') {
                return {
                    upsert: async (payload: { id: string; phone: string; whatsapp_verified: boolean }) => {
                        profiles.set(payload.id, payload);
                        return { data: payload, error: null };
                    },
                };
            }

            throw new Error(`Unsupported table: ${table}`);
        }),
        __getAttempts() {
            return attempts;
        },
    };

    return admin;
}

describe('whatsApp mobile auth integration', () => {
    const mockedCreateClient = createClient as unknown as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        __resetMobileExchangeStoreForTests();

        process.env.WHATSAPP_OTP_TEMPLATE_NAME = 'kezek_test';
        process.env.WHATSAPP_OTP_TEMPLATE_LANG = 'ru';

        (sendWhatsApp as jest.Mock).mockResolvedValue(undefined);
        (createWhatsAppSignInSession as jest.Mock).mockResolvedValue({
            ok: true,
            data: {
                email: 'wa_user@example.com',
                password: 'temp-pass',
            },
        });
        mockedCreateClient.mockReturnValue({
            auth: {
                signInWithPassword: jest.fn().mockResolvedValue({
                    data: {
                        session: {
                            access_token: 'access-token',
                            refresh_token: 'refresh-token',
                        },
                    },
                    error: null,
                }),
            },
        });
    });

    test('happy-path: start -> verify -> mobile exchange session', async () => {
        const admin = createInMemoryAdmin();

        const start = await runWhatsAppMobileStartRoute({
            admin: admin as never,
            phone: '+996500574029',
        });
        expect(start.ok).toBe(true);
        if (!start.ok) {
            return;
        }

        const attempt = admin.__getAttempts()[0];
        const verify = await runWhatsAppMobileVerifyRoute({
            admin: admin as never,
            attemptId: start.payload.attemptId,
            code: attempt.code ?? '',
            phone: '+996500574029',
        });
        expect(verify.ok).toBe(true);
        if (!verify.ok) {
            return;
        }

        const exchangeReq = createMockNextRequest(
            `http://localhost/api/auth/mobile-exchange?code=${verify.payload.exchangeCode}`,
            { method: 'GET' },
        );
        const exchangeRes = await mobileExchangeGET(exchangeReq);
        const exchangeData = await expectSuccessResponse(exchangeRes, 200);
        expect(exchangeData).toHaveProperty('data.accessToken', 'access-token');
        expect(exchangeData).toHaveProperty('data.refreshToken', 'refresh-token');
    });

    test('wrong code then success', async () => {
        const admin = createInMemoryAdmin();

        const start = await runWhatsAppMobileStartRoute({
            admin: admin as never,
            phone: '+996500574029',
        });
        expect(start.ok).toBe(true);
        if (!start.ok) {
            return;
        }

        const badVerify = await runWhatsAppMobileVerifyRoute({
            admin: admin as never,
            attemptId: start.payload.attemptId,
            code: '000000',
            phone: '+996500574029',
        });
        expect(badVerify.ok).toBe(false);
        if (badVerify.ok) {
            return;
        }
        expect(badVerify.status).toBe(400);

        const goodCode = admin.__getAttempts()[0].code ?? '';
        const okVerify = await runWhatsAppMobileVerifyRoute({
            admin: admin as never,
            attemptId: start.payload.attemptId,
            code: goodCode,
            phone: '+996500574029',
        });
        expect(okVerify.ok).toBe(true);
    });

    test('expired otp is rejected', async () => {
        const admin = createInMemoryAdmin();
        const now = Date.now();
        const expiredIso = new Date(now - 60_000).toISOString();
        admin.__getAttempts().push({
            id: 'attempt-expired',
            phone: '+996500574029',
            phone_hash: null,
            otp_hash: null,
            code: '123456',
            status: 'pending',
            expires_at: expiredIso,
            used_at: null,
            consumed_at: null,
            failed_attempts: 0,
            locked_until: null,
        });

        const verify = await runWhatsAppMobileVerifyRoute({
            admin: admin as never,
            attemptId: 'attempt-expired',
            code: '123456',
            phone: '+996500574029',
        });
        expect(verify.ok).toBe(false);
        if (verify.ok) {
            return;
        }
        expect(verify.status).toBe(410);
    });

    test('provider temporary failure on start then retry success', async () => {
        const admin = createInMemoryAdmin();
        (sendWhatsApp as jest.Mock)
            .mockRejectedValueOnce(new Error('timeout'))
            .mockResolvedValueOnce(undefined);

        const first = await runWhatsAppMobileStartRoute({
            admin: admin as never,
            phone: '+996500574029',
        });
        expect(first.ok).toBe(false);

        const second = await runWhatsAppMobileStartRoute({
            admin: admin as never,
            phone: '+996500574029',
        });
        expect(second.ok).toBe(true);
    });
});
