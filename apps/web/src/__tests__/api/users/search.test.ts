/**
 * Тесты для /api/users/search
 * Поиск аккаунтов для менеджеров: полный e-mail/телефон или клиенты своего бизнеса (API-01).
 */

import { POST } from '@/app/api/users/search/route';
import { createMockRequest, createMockSupabase, expectSuccessResponse } from '../testHelpers';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

type Row = Record<string, unknown>;

describe('/api/users/search', () => {
    const mockSupabase = createMockSupabase();
    const bizId = 'biz-uuid';
    let admin: {
        auth: { admin: { listUsers: jest.Mock } };
        rpc: jest.Mock;
        from: jest.Mock;
        bookings: { eq: jest.Mock };
    };

    function setupAdmin(options: { exact?: Row[]; bookings?: Row[]; accounts?: Row[] } = {}) {
        const bookings = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            not: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: options.bookings ?? [], error: null }),
        };
        const accounts = {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: options.accounts ?? [], error: null }),
        };
        const profiles = {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
        const tables: Record<string, unknown> = { bookings, auth_users_view: accounts, profiles };
        admin = {
            auth: { admin: { listUsers: jest.fn() } },
            rpc: jest.fn().mockResolvedValue({ data: options.exact ?? [], error: null }),
            from: jest.fn((table: string) => tables[table]),
            bookings,
        };
        (getServiceClient as jest.Mock).mockReturnValue(admin);
    }

    function mockStaff(userIds: string[]) {
        mockSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            not: jest.fn().mockResolvedValue({ data: userIds.map((user_id) => ({ user_id })), error: null }),
        });
    }

    const searchRequest = (body: Row) => createMockRequest('http://localhost/api/users/search', { method: 'POST', body });

    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ supabase: mockSupabase, bizId });
    });

    describe('Успешный поиск', () => {
        test('полный e-mail находит аккаунт с подтверждённым адресом и исключает сотрудников бизнеса', async () => {
            setupAdmin({
                exact: [
                    { id: 'user-1', email: 'user@example.com', phone: null, full_name: 'Staff Member' },
                    { id: 'user-2', email: 'user@example.com', phone: null, full_name: 'User 2' },
                ],
            });
            mockStaff(['user-1']);

            const data = await expectSuccessResponse(await POST(searchRequest({ q: 'user@example.com', page: 1, perPage: 50 })), 200);

            expect(admin.rpc).toHaveBeenCalledWith('find_accounts_by_contact', { p_email: 'user@example.com' });
            expect(data).toMatchObject({ ok: true, page: 1, perPage: 50 });
            expect((data as { items: Row[] }).items).toEqual([{ id: 'user-2', email: 'user@example.com', phone: null, full_name: 'User 2' }]);
            expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
        });

        test('частичный текст ищет только среди клиентов своего бизнеса', async () => {
            setupAdmin({
                bookings: [{ client_id: 'user-1' }, { client_id: 'user-2' }],
                accounts: [
                    { id: 'user-1', email: 'john@example.com', phone: '996555111111', full_name: 'John Doe' },
                    { id: 'user-2', email: 'jane@example.com', phone: '996555222222', full_name: 'Jane Smith' },
                ],
            });
            mockStaff([]);

            const data = await expectSuccessResponse(await POST(searchRequest({ q: 'john', page: 1, perPage: 50 })), 200);

            const items = (data as { items: Array<{ email: string | null }> }).items;
            expect(items.map((item) => item.email)).toEqual(['john@example.com']);
            expect(admin.bookings.eq).toHaveBeenCalledWith('biz_id', bizId);
            expect(admin.rpc).not.toHaveBeenCalled();
            expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
        });

        test('должен ограничить page и perPage в допустимых пределах', async () => {
            setupAdmin();

            const data = await expectSuccessResponse(await POST(searchRequest({ q: 'known', page: 200, perPage: 200 })), 200);

            expect(data).toMatchObject({ ok: true, items: [], page: 100, perPage: 100 });
        });

        test('должен ограничить длину поискового запроса', async () => {
            setupAdmin();

            const data = await expectSuccessResponse(await POST(searchRequest({ q: 'a'.repeat(200) })), 200);

            expect(data).toMatchObject({ ok: true, items: [] });
            expect(admin.rpc).not.toHaveBeenCalled();
        });
    });
});
