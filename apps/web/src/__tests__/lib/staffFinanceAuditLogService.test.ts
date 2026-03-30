import { loadStaffFinanceAuditLog, type StaffFinanceAuditAdminLike } from '@/lib/staffFinanceAuditLogService';

describe('staffFinanceAuditLogService', () => {
    function createAuditQuery(rows: unknown[] | null, error: { message: string } | null = null) {
        const query = {
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
                data: rows,
                error,
            }),
        };

        return {
            select: jest.fn().mockReturnValue(query),
            query,
        };
    }

    function createProfilesQuery(rows: unknown[] | null) {
        const query = {
            in: jest.fn().mockResolvedValue({
                data: rows,
                error: null,
            }),
        };

        return {
            select: jest.fn().mockReturnValue(query),
            query,
        };
    }

    test('loads audit entries and enriches changer names', async () => {
        const audit = createAuditQuery([
            {
                id: 'entry-1',
                changed_at: '2026-03-27T10:00:00.000Z',
                changed_by_user_id: 'user-1',
                field_changes: [{ field: 'percent_master', old_value: 50, new_value: 60 }],
                message: 'updated',
            },
            {
                id: 'entry-2',
                changed_at: '2026-03-27T09:00:00.000Z',
                changed_by_user_id: null,
                field_changes: null,
                message: null,
            },
        ]);
        const profiles = createProfilesQuery([{ id: 'user-1', full_name: 'Ada Manager' }]);
        const admin = {
            from: jest.fn((table: string) =>
                table === 'finance_settings_audit_log' ? audit : profiles,
            ),
        } as unknown as StaffFinanceAuditAdminLike;

        const result = await loadStaffFinanceAuditLog({
            admin,
            bizId: 'biz-1',
            staffId: 'staff-1',
        });

        expect(result).toEqual({
            ok: true,
            entries: [
                {
                    id: 'entry-1',
                    changed_at: '2026-03-27T10:00:00.000Z',
                    changed_by_user_id: 'user-1',
                    changed_by_name: 'Ada Manager',
                    field_changes: [{ field: 'percent_master', old_value: 50, new_value: 60 }],
                    message: 'updated',
                },
                {
                    id: 'entry-2',
                    changed_at: '2026-03-27T09:00:00.000Z',
                    changed_by_user_id: null,
                    changed_by_name: null,
                    field_changes: [],
                    message: null,
                },
            ],
        });
    });

    test('returns internal error when audit query fails', async () => {
        const audit = createAuditQuery(null, { message: 'db failed' });
        const admin = {
            from: jest.fn(() => audit),
        } as unknown as StaffFinanceAuditAdminLike;

        const result = await loadStaffFinanceAuditLog({
            admin,
            bizId: 'biz-1',
            staffId: 'staff-1',
        });

        expect(result).toEqual({
            ok: false,
            error: 'internal',
            message: 'db failed',
            status: 500,
        });
    });
});
