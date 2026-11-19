jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

jest.mock('@/lib/staffSchedule', () => ({
    initializeStaffSchedule: jest.fn(),
}));

import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { initializeStaffSchedule } from '@/lib/staffSchedule';
import { runStaffCreateFromUser } from '@/lib/staffCreateFromUserService';

describe('staffCreateFromUserService', () => {
    const bizId = 'biz-uuid';
    const branchId = 'branch-uuid';
    const userId = 'user-uuid';
    let admin: any;

    beforeEach(() => {
        jest.clearAllMocks();
        admin = {
            auth: {
                admin: {
                    getUserById: jest.fn(),
                },
            },
            from: jest.fn(),
        };

        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: { id: branchId, biz_id: bizId },
            error: null,
        });
        (initializeStaffSchedule as jest.Mock).mockResolvedValue({
            success: true,
            daysCreated: 14,
        });
    });

    test('returns validation error when required fields are missing', async () => {
        const result = await runStaffCreateFromUser({
            admin,
            bizId,
            body: {
                user_id: '',
                branch_id: '',
            },
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'user_id и branch_id обязательны',
        });
    });

    test('creates a staff member and initializes schedule', async () => {
        admin.auth.admin.getUserById.mockResolvedValue({
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

        admin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'staff-id' },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                is: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: 'role-staff-id' },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

        const result = await runStaffCreateFromUser({
            admin,
            bizId,
            body: {
                user_id: userId,
                branch_id: branchId,
                is_active: true,
            },
        });

        expect(result).toEqual({
            ok: true,
            data: {
                id: 'staff-id',
                schedule_initialized: true,
                schedule_days_created: 14,
                schedule_error: null,
            },
        });
        expect(initializeStaffSchedule).toHaveBeenCalledWith(
            admin,
            bizId,
            'staff-id',
            branchId,
        );
    });

    // ARCH-07: a namesake's card is never linked to this account or returned as its card.
    test('reuses the card linked to the account and never matches a card by name', async () => {
        admin.auth.admin.getUserById.mockResolvedValue({
            data: { user: { id: userId, email: 'a@example.com', phone: null, user_metadata: { full_name: 'Aigerim' } } },
            error: null,
        });
        const lookup = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'own-card' }, error: null }),
        };
        const rest = () => {
            const chain: Record<string, unknown> = { then: (resolve: (value: unknown) => void) => resolve({ data: null, error: null }) };
            for (const method of ['select', 'eq', 'is', 'limit', 'insert', 'update', 'upsert']) chain[method] = jest.fn(() => chain);
            chain.maybeSingle = jest.fn().mockResolvedValue({ data: { id: 'existing-row' }, error: null });
            return chain;
        };
        const tables: string[] = [];
        admin.from.mockImplementation((table: string) => {
            tables.push(table);
            return tables.length === 1 ? lookup : rest();
        });

        const result = await runStaffCreateFromUser({ admin, bizId, body: { user_id: userId, branch_id: branchId } });

        expect(lookup.eq).toHaveBeenCalledWith('biz_id', bizId);
        expect(lookup.eq).toHaveBeenCalledWith('user_id', userId);
        expect(lookup.eq).not.toHaveBeenCalledWith('full_name', expect.anything());
        // One read of staff: no new card and no card relinked.
        expect(tables.filter((table) => table === 'staff')).toHaveLength(1);
        expect(result).toMatchObject({ ok: true, data: { id: 'own-card' } });
    });

    test('a failed lookup of existing cards is a server error, not a new card', async () => {
        admin.auth.admin.getUserById.mockResolvedValue({
            data: { user: { id: userId, email: 'a@example.com', phone: null, user_metadata: {} } },
            error: null,
        });
        admin.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } }),
        });

        const result = await runStaffCreateFromUser({ admin, bizId, body: { user_id: userId, branch_id: branchId } });

        expect(result).toMatchObject({ ok: false, status: 500, error: 'internal' });
        expect(admin.from).toHaveBeenCalledTimes(1);
    });

    test('returns not_found when auth admin user is missing', async () => {
        admin.auth.admin.getUserById.mockResolvedValue({ data: { user: null }, error: { message: 'User not found' } });

        const result = await runStaffCreateFromUser({
            admin,
            bizId,
            body: {
                user_id: userId,
                branch_id: branchId,
            },
        });

        expect(result).toEqual({
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Пользователь не найден',
        });
    });
});
