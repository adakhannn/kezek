jest.mock('@/lib/senders/whatsapp', () => ({
    sendWhatsApp: jest.fn(),
}));

jest.mock('@/lib/mobileExchangeService', () => ({ ...jest.requireActual('@/lib/mobileExchangeService'), issueMobileSessionGrant: jest.fn(async () => ({ code: 'bound-grant' })) }));
import { issueMobileSessionGrant } from '@/lib/mobileExchangeService';
import { runWhatsAppMobileStartRoute } from '@/lib/whatsAppMobileStartRouteService';
import { runWhatsAppMobileVerifyRoute } from '@/lib/whatsAppMobileVerifyRouteService';
import { sendWhatsApp } from '@/lib/senders/whatsapp';

type AttemptRow = {
    code_challenge?: string;
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
    const profiles = new Map<string, { id: string; whatsapp_phone: string; whatsapp_verified: boolean }>();
    const users: Array<{ id: string; phone: string; user_metadata?: Record<string, unknown> }> = [];
    let seq = 1;

    const admin = {
        rpc: jest.fn(async (_name: string, args: Record<string, string>) => {
            const row = attempts.find(it => it.id === args.p_attempt_id);
            if (_name === 'register_whatsapp_mobile_otp_failure') {
                if (!row || row.used_at || row.status !== 'pending') return { data: 5, error: null };
                row.failed_attempts += 1;
                if (row.failed_attempts >= 5) row.status = 'failed';
                return { data: row.failed_attempts, error: null };
            }
            if (!row || row.used_at || row.otp_hash !== args.p_otp_hash || row.code_challenge !== args.p_code_challenge) return { data: false, error: null };
            row.used_at = row.consumed_at = new Date().toISOString();
            row.status = 'consumed';
            return { data: true, error: null };
        }),
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
                    select() {
                        const filters = new Map<string, unknown>();
                        const builder = {
                            eq(field: string, value: unknown) {
                                filters.set(field, value);
                                return builder;
                            },
                            limit: async (count: number) => ({
                                data: [...profiles.values()]
                                    .filter((profile) =>
                                        [...filters.entries()].every(
                                            ([field, value]) =>
                                                profile[field as keyof typeof profile] === value,
                                        ),
                                    )
                                    .slice(0, count)
                                    .map(({ id }) => ({ id })),
                                error: null,
                            }),
                        };
                        return builder;
                    },
                    upsert: async (payload: { id: string; whatsapp_phone: string; whatsapp_verified: boolean }) => {
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
        __getProfiles() {
            return profiles;
        },
        __getUsers() {
            return users;
        },
    };

    return admin;
}

describe('whatsApp mobile auth integration', () => {

    beforeEach(() => {
        jest.clearAllMocks();

        process.env.WHATSAPP_OTP_TEMPLATE_NAME = 'kezek_test';
        process.env.WHATSAPP_OTP_TEMPLATE_LANG = 'ru';
        process.env.WHATSAPP_OTP_TEMPLATE_TYPE = 'utility';
        delete process.env.WHATSAPP_OTP_TEMPLATE_COMPONENTS_JSON;

        (sendWhatsApp as jest.Mock).mockResolvedValue(undefined);
    });

    test('happy-path: start -> verify -> mobile exchange session', async () => {
        const admin = createInMemoryAdmin();

        const start = await runWhatsAppMobileStartRoute({
            admin: admin as never,
            codeChallenge: 'a'.repeat(64),
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

        expect(verify.payload.exchangeCode).toBe('bound-grant');
        expect(issueMobileSessionGrant).toHaveBeenCalledWith({ userId: verify.payload.userId, codeChallenge: 'a'.repeat(64) });
    });

    test('signs in to the existing account linked through a verified profile', async () => {
        const admin = createInMemoryAdmin();
        admin.__getProfiles().set('existing-user', {
            id: 'existing-user',
            whatsapp_phone: '+996500574029',
            whatsapp_verified: true,
        });

        const start = await runWhatsAppMobileStartRoute({
            admin: admin as never,
            codeChallenge: 'a'.repeat(64),
            phone: '+996500574029',
        });
        expect(start.ok).toBe(true);
        if (!start.ok) return;

        const attempt = admin.__getAttempts()[0];
        const verify = await runWhatsAppMobileVerifyRoute({
            admin: admin as never,
            attemptId: start.payload.attemptId,
            code: attempt.code ?? '',
            phone: '+996500574029',
        });

        expect(verify.ok).toBe(true);
        if (!verify.ok) return;
        expect(verify.payload.userId).toBe('existing-user');
        expect(verify.payload.linkage).toBe('existing');
        expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
        expect(issueMobileSessionGrant).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'existing-user' }),
        );
    });

    test('wrong code then success', async () => {
        const admin = createInMemoryAdmin();

        const start = await runWhatsAppMobileStartRoute({
            admin: admin as never,
            codeChallenge: 'a'.repeat(64),
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
            codeChallenge: 'a'.repeat(64),
            phone: '+996500574029',
        });
        expect(first.ok).toBe(false);

        const second = await runWhatsAppMobileStartRoute({
            admin: admin as never,
            codeChallenge: 'a'.repeat(64),
            phone: '+996500574029',
        });
        expect(second.ok).toBe(true);
    });

    test('supports configurable template components with OTP placeholder replacement', async () => {
        const admin = createInMemoryAdmin();
        process.env.WHATSAPP_OTP_TEMPLATE_TYPE = 'authentication';
        process.env.WHATSAPP_OTP_TEMPLATE_COMPONENTS_JSON = JSON.stringify([
            {
                type: 'body',
                parameters: [{ type: 'text', text: '{{OTP_CODE}}' }],
            },
            {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: '{{OTP_CODE}}' }],
            },
        ]);

        const start = await runWhatsAppMobileStartRoute({
            admin: admin as never,
            codeChallenge: 'a'.repeat(64),
            phone: '+996500574029',
        });
        expect(start.ok).toBe(true);

        const sendArgs = (sendWhatsApp as jest.Mock).mock.calls.at(-1)?.[0];
        expect(sendArgs?.template?.components?.[0]?.parameters?.[0]?.text).toMatch(/^\d{6}$/);
        expect(sendArgs?.template?.components?.[1]?.parameters?.[0]?.text).toMatch(/^\d{6}$/);
    });
    test('two concurrent valid OTP verifications issue only one grant', async () => {
        const admin = createInMemoryAdmin();
        const start = await runWhatsAppMobileStartRoute({ admin: admin as never, phone: '+996500574029', codeChallenge: 'a'.repeat(64) });
        if (!start.ok) throw new Error('start failed');
        const input = { admin: admin as never, attemptId: start.payload.attemptId, code: admin.__getAttempts()[0].code ?? '', phone: '+996500574029' };
        const results = await Promise.all([runWhatsAppMobileVerifyRoute(input), runWhatsAppMobileVerifyRoute(input)]);
        expect(results.filter(result => result.ok)).toHaveLength(1);
        expect(issueMobileSessionGrant).toHaveBeenCalledTimes(1);
        expect(admin.auth.admin.createUser).toHaveBeenCalledTimes(1);
    });
    test('failed atomic consume prevents user mutation and grant issuance', async () => {
        const admin = createInMemoryAdmin();
        const start = await runWhatsAppMobileStartRoute({ admin: admin as never, phone: '+996500574029', codeChallenge: 'a'.repeat(64) });
        if (!start.ok) throw new Error('start failed');
        admin.rpc.mockResolvedValueOnce({ data: false, error: null });
        const result = await runWhatsAppMobileVerifyRoute({ admin: admin as never, attemptId: start.payload.attemptId, code: admin.__getAttempts()[0].code ?? '' });
        expect(result).toMatchObject({ ok: false, status: 409 });
        expect(issueMobileSessionGrant).not.toHaveBeenCalled();
        expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    });
});
