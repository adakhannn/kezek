import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { resolveBizContextForManagers } from '@/lib/bizContextResolver';
import { BizAccessError } from '@/lib/authDiagnostics';
import { MANAGER_ROLE_KEYS } from '@/lib/authContext';

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
    logWarn: jest.fn(),
}));

/** Thenable для мока запросов без maybeSingle (user_roles, roles). */
function makeThenable(data: unknown) {
    const chain: any = {
        then(resolve: (v: any) => void) {
            resolve({ data, error: null });
        },
        select: () => chain,
        eq: () => chain,
    };
    return chain;
}

describe('resolveBizContextForManagers – выбор бизнеса', () => {
    const mockSupabase: any = {
        auth: {
            getUser: jest.fn(),
        },
        rpc: jest.fn(),
    };

    const mockAdmin: any = {
        from: jest.fn(() => mockAdmin),
        select: jest.fn(() => mockAdmin),
        eq: jest.fn(() => mockAdmin),
        not: jest.fn(() => mockAdmin),
        in: jest.fn(() => mockAdmin),
        order: jest.fn(() => mockAdmin),
        limit: jest.fn(() => mockAdmin),
        maybeSingle: jest.fn(),
    };

    beforeEach(() => {
        jest.resetAllMocks();
        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockAdmin);

        (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
            data: { user: { id: 'user-1', email: 'owner@example.com' } },
            error: null,
        });

        // по умолчанию не super_admin
        (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data: false, error: null });

        // цепочка для from().select().eq().maybeSingle() и т.д. (resetAllMocks сбрасывает реализации)
        // Плюс дефолтный lookup timezone бизнеса, который теперь делается в конце resolveBizContextForManagers.
        (mockAdmin.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'businesses') {
                return {
                    select: jest.fn((columns: string) => {
                        if (columns === 'tz') {
                            return {
                                eq: jest.fn(() => ({
                                    maybeSingle: jest.fn().mockResolvedValue({
                                        data: { tz: 'Asia/Almaty' },
                                        error: null,
                                    }),
                                })),
                            };
                        }
                        return mockAdmin;
                    }),
                    eq: jest.fn(() => mockAdmin),
                    order: jest.fn(() => mockAdmin),
                    limit: jest.fn(() => mockAdmin),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { tz: 'Asia/Almaty' },
                        error: null,
                    }),
                };
            }
            return mockAdmin;
        });
        (mockAdmin.select as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.eq as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.order as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.limit as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.maybeSingle as jest.Mock).mockResolvedValue({
            data: { tz: 'Asia/Almaty' },
            error: null,
        });

        expect(MANAGER_ROLE_KEYS.size).toBeGreaterThan(0);
    });

    test('выбирает бизнес по owner_id, если нет current_biz и ролей', async () => {
        // user_current_business: нет записи
        (mockAdmin.maybeSingle as jest.Mock)
            // user_current_business
            .mockResolvedValueOnce({ data: null, error: null })
            // owned business via owner_id
            .mockResolvedValueOnce({
                data: { id: 'biz-owner-1', slug: 'owner-biz', name: 'Owner Biz' },
                error: null,
            });

        // user_roles / roles: пусто
        (mockAdmin.from as jest.Mock)
            .mockReturnValueOnce(mockAdmin) // user_current_business
            .mockReturnValueOnce(mockAdmin) // user_roles all
            .mockReturnValueOnce(mockAdmin) // roles all
            .mockReturnValueOnce(mockAdmin) // businesses by owner_id (maybeSingle)
            .mockReturnValueOnce(mockAdmin); // businesses count

        (mockAdmin.select as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.eq as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.order as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.limit as jest.Mock).mockReturnValue(mockAdmin);

        const result = await resolveBizContextForManagers();
        expect(result.bizId).toBe('biz-owner-1');
        expect(result.userId).toBe('user-1');
    });

    test('super_admin без current_biz, но с бизнесом kezek', async () => {
        (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });

        // user_current_business → нет
        (mockAdmin.maybeSingle as jest.Mock)
            // current biz
            .mockResolvedValueOnce({ data: null, error: null })
            // kezek business
            .mockResolvedValueOnce({
                data: { id: 'biz-kezek', slug: 'kezek', name: 'Kezek' },
                error: null,
            });

        (mockAdmin.from as jest.Mock)
            .mockReturnValueOnce(mockAdmin) // user_current_business
            .mockReturnValueOnce(mockAdmin); // businesses where slug = 'kezek'

        (mockAdmin.select as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.eq as jest.Mock).mockReturnValue(mockAdmin);

        const result = await resolveBizContextForManagers();
        expect(result.bizId).toBe('biz-kezek');
    });

    test('бросает NO_BIZ_ACCESS, если бизнес не найден ни по каким правилам', async () => {
        // user_current_business: нет
        (mockAdmin.maybeSingle as jest.Mock).mockResolvedValue({ data: null, error: null });

        (mockAdmin.from as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.select as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.eq as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.in as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.order as jest.Mock).mockReturnValue(mockAdmin);
        (mockAdmin.limit as jest.Mock).mockReturnValue(mockAdmin);

        // user_roles / roles → пусто
        (mockAdmin as any).data = null;

        await expect(resolveBizContextForManagers()).rejects.toBeInstanceOf(BizAccessError);
    });

    test('выбирает бизнес только по user_roles (роль admin, без owner_id)', async () => {
        (mockAdmin.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'user_current_business') return mockAdmin;
            if (table === 'user_roles')
                return makeThenable([{ biz_id: 'biz-by-role', role_id: 'role-admin' }]);
            if (table === 'roles')
                return makeThenable([{ id: 'role-admin', key: 'admin' }]);
            return mockAdmin;
        });
        (mockAdmin.maybeSingle as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

        const result = await resolveBizContextForManagers();
        expect(result.bizId).toBe('biz-by-role');
        expect(result.userId).toBe('user-1');
    });

    test('super_admin с current_biz возвращает выбранный бизнес из user_current_business', async () => {
        (mockSupabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });
        (mockAdmin.maybeSingle as jest.Mock)
            .mockResolvedValueOnce({ data: { biz_id: 'biz-super-picked' }, error: null })
            .mockResolvedValueOnce({
                data: { id: 'biz-super-picked', slug: 'picked', name: 'Picked Biz' },
                error: null,
            });

        const result = await resolveBizContextForManagers();
        expect(result.bizId).toBe('biz-super-picked');
    });

    test('несколько бизнесов по user_roles: выбирается детерминированно по biz_id', async () => {
        (mockAdmin.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'user_current_business') return mockAdmin;
            if (table === 'user_roles')
                return makeThenable([
                    { biz_id: 'biz-zzz', role_id: 'r1' },
                    { biz_id: 'biz-aaa', role_id: 'r1' },
                ]);
            if (table === 'roles') return makeThenable([{ id: 'r1', key: 'manager' }]);
            return mockAdmin;
        });
        (mockAdmin.maybeSingle as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

        const result = await resolveBizContextForManagers();
        expect(result.bizId).toBe('biz-aaa');
    });

    test('при валидном current_biz он имеет приоритет над авто-выбором по user_roles', async () => {
        (mockAdmin.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'user_current_business') return mockAdmin;
            if (table === 'user_roles') {
                return makeThenable([
                    { biz_id: 'biz-current', role_id: 'role-manager' },
                    { biz_id: 'biz-other', role_id: 'role-manager' },
                ]);
            }
            if (table === 'roles') return makeThenable([{ id: 'role-manager', key: 'manager' }]);
            return mockAdmin;
        });

        (mockAdmin.maybeSingle as jest.Mock).mockResolvedValueOnce({
            data: { biz_id: 'biz-current' },
            error: null,
        });

        const result = await resolveBizContextForManagers();
        expect(result.bizId).toBe('biz-current');
    });

    test('отсутствие прав: current_biz без допустимой роли и нет автовыбора → NO_BIZ_ACCESS', async () => {
        (mockAdmin.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'user_current_business') return mockAdmin;
            if (table === 'user_roles')
                return makeThenable([{ biz_id: 'biz-lost', role_id: 'role-staff' }]);
            if (table === 'roles')
                return makeThenable([{ id: 'role-staff', key: 'staff' }]);
            return mockAdmin;
        });
        (mockAdmin.maybeSingle as jest.Mock).mockResolvedValueOnce({
            data: { biz_id: 'biz-lost' },
            error: null,
        });

        await expect(resolveBizContextForManagers()).rejects.toMatchObject({
            code: 'NO_BIZ_ACCESS',
        });
    });

    test('бросает NOT_AUTHENTICATED при отсутствии пользователя', async () => {
        (mockSupabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
            data: { user: null },
            error: null,
        });

        await expect(resolveBizContextForManagers()).rejects.toMatchObject({
            code: 'NOT_AUTHENTICATED',
        });
    });
});

