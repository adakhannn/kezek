/**
 * Тесты для /api/staff/create-from-user
 * Создание сотрудника из существующего пользователя
 */

import { POST } from '@/app/api/staff/create-from-user/route';
import { createMockRequest, createMockSupabase, createTableMock, expectSuccessResponse, expectErrorResponse, expectBusinessScoped, recordQueries, type RecordedQuery } from '../testHelpers';

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

jest.mock('@/lib/staffSchedule', () => ({
    initializeStaffSchedule: jest.fn().mockResolvedValue({
        success: true,
        daysCreated: 14,
    }),
}));

describe('/api/staff/create-from-user', () => {
    const mockAdmin = createMockSupabase();
    const db = recordQueries(mockAdmin);
    const bizId = 'biz-uuid';
    const branchId = 'branch-uuid';
    const userId = 'user-uuid';

    beforeEach(() => {
        jest.clearAllMocks();
        db.queries.length = 0;

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(db.client);
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии обязательных полей', async () => {
            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: {},
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'INVALID_BODY');
        });

        test('должен вернуть 400 при отсутствии user_id', async () => {
            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: {
                    branch_id: branchId,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'INVALID_BODY');
        });

        test('должен вернуть 400 при отсутствии branch_id', async () => {
            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: {
                    user_id: userId,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'INVALID_BODY');
        });
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 400 если филиал не принадлежит бизнесу', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: null,
                error: 'Resource not found',
            });

            // Мокаем список пользователей
            mockAdmin.auth.admin.getUserById.mockResolvedValue({
                data: {
                    user: {
                            id: userId,
                            email: 'test@example.com',
                            phone: '+996555123456',
                            user_metadata: { full_name: 'Test User' },
                        },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: {
                    user_id: userId,
                    branch_id: branchId,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 403, 'BRANCH_NOT_IN_THIS_BUSINESS');
        });

        test('должен вернуть 404 если пользователь не найден', async () => {
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
                data: {
                    id: branchId,
                    biz_id: bizId,
                },
                error: null,
            });

            // Мокаем список пользователей (пользователь не найден)
            mockAdmin.auth.admin.getUserById.mockResolvedValue({ data: { user: null }, error: { message: 'User not found' } });

            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: {
                    user_id: 'non-existent-user',
                    branch_id: branchId,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 404, 'USER_NOT_FOUND');
        });
    });

    // API-06: the card is created without the account; the person gets an invitation to accept.
    describe('Приглашение вместо привязки', () => {
        const has = (query: RecordedQuery, method: string) => query.calls.some(([name]) => name === method);

        function tableClient(ownCard: unknown) {
            const admin = createTableMock({
                staff: (query) => (has(query, 'insert') ? { data: { id: 'staff-id' } } : { data: ownCard }),
                staff_invitations: (query) => (has(query, 'insert') ? { data: { id: 'inv-id', staff_id: 'staff-id' } } : { data: null }),
                staff_branch_assignments: { data: null },
            });
            admin.auth.admin.getUserById.mockResolvedValue({
                data: { user: { id: userId, email: 'test@example.com', phone: '+996555123456', user_metadata: { full_name: 'Test User' } } },
                error: null,
            });
            (getServiceClient as jest.Mock).mockReturnValue(admin);
            (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId, userId: 'manager-uuid' });
            (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({ data: { id: branchId, biz_id: bizId }, error: null });
            return admin;
        }

        test('создаёт карточку без аккаунта и приглашение, роль не выдаёт', async () => {
            const admin = tableClient(null);
            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: { user_id: userId, branch_id: branchId, is_active: true },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toMatchObject({
                ok: true,
                message: 'Приглашение отправлено. Сотрудник появится в команде после подтверждения.',
                id: 'staff-id',
                staff_id: 'staff-id',
                invitation_id: 'inv-id',
                status: 'pending',
                schedule_initialized: true,
                schedule_days_created: 14,
            });
            const staffInsert = admin.queries.find((query) => query.table === 'staff' && has(query, 'insert'));
            expect(staffInsert?.calls.find(([name]) => name === 'insert')?.[1]).toMatchObject({ user_id: null });
            expect(staffInsert?.calls.find(([name]) => name === 'insert')?.[1]).not.toHaveProperty('email');
            expect(admin.queries.map((query) => query.table)).not.toContain('user_roles');
            expectBusinessScoped(admin, 'staff', bizId);
            expectBusinessScoped(admin, 'staff_invitations', bizId);
        });

        test('карточка, уже привязанная к этому аккаунту, остаётся; приглашения нет', async () => {
            const admin = tableClient({ id: 'existing-staff-id' });
            const req = createMockRequest('http://localhost/api/staff/create-from-user', {
                method: 'POST',
                body: { user_id: userId, branch_id: branchId },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toMatchObject({ ok: true, id: 'existing-staff-id', invitation_id: null, status: 'already_staff' });
            const lookup = admin.queries[0];
            expect(lookup.calls).toEqual(expect.arrayContaining([['eq', 'user_id', userId]]));
            expect(lookup.calls.some(([, column]) => column === 'full_name')).toBe(false);
            expect(admin.queries.map((query) => query.table)).not.toContain('staff_invitations');
        });
    });
});
