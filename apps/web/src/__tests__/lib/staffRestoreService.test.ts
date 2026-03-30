import { runStaffRestore } from '@/lib/staffRestoreService';

describe('staffRestoreService', () => {
    test('returns not_found when staff does not belong to business', async () => {
        const result = await runStaffRestore({
            admin: { from: jest.fn() } as never,
            roleAdmin: { from: jest.fn() } as never,
            bizId: 'biz-1',
            staffId: 'staff-1',
            checkResourceBelongsToBiz: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        });

        expect(result).toEqual({
            ok: false,
            error: 'not_found',
            message: 'Сотрудник не найден',
            status: 404,
        });
    });

    test('returns validation error when staff reactivation fails', async () => {
        const eqBiz = jest.fn().mockResolvedValue({
            error: { message: 'update failed' },
        });
        const eqId = jest.fn().mockReturnValue({ eq: eqBiz });
        const update = jest.fn().mockReturnValue({ eq: eqId });
        const admin = { from: jest.fn().mockReturnValue({ update }) };

        const result = await runStaffRestore({
            admin: admin as never,
            roleAdmin: { from: jest.fn() } as never,
            bizId: 'biz-1',
            staffId: 'staff-1',
            checkResourceBelongsToBiz: jest.fn().mockResolvedValue({
                data: { id: 'staff-1', biz_id: 'biz-1', user_id: null, is_active: false },
                error: null,
            }),
        });

        expect(result).toEqual({
            ok: false,
            error: 'validation',
            message: 'update failed',
            status: 400,
        });
    });

    test('restores card and reassigns staff role for linked user', async () => {
        const eqBiz = jest.fn().mockResolvedValue({
            error: null,
        });
        const eqId = jest.fn().mockReturnValue({ eq: eqBiz });
        const update = jest.fn().mockReturnValue({ eq: eqId });

        const rolesMaybeSingle = jest.fn().mockResolvedValue({
            data: { id: 'role-staff' },
            error: null,
        });
        const rolesEq = jest.fn().mockReturnValue({ maybeSingle: rolesMaybeSingle });
        const rolesSelect = jest.fn().mockReturnValue({ eq: rolesEq });

        const userRolesUpsert = jest.fn().mockResolvedValue({
            error: null,
        });

        const roleAdmin = {
            from: jest.fn((table: string) => {
                if (table === 'roles') {
                    return { select: rolesSelect };
                }
                if (table === 'user_roles') {
                    return { upsert: userRolesUpsert };
                }
                throw new Error(`Unexpected table ${table}`);
            }),
        };

        const result = await runStaffRestore({
            admin: { from: jest.fn().mockReturnValue({ update }) } as never,
            roleAdmin: roleAdmin as never,
            bizId: 'biz-1',
            staffId: 'staff-1',
            checkResourceBelongsToBiz: jest.fn().mockResolvedValue({
                data: { id: 'staff-1', biz_id: 'biz-1', user_id: 'user-1', is_active: false },
                error: null,
            }),
        });

        expect(userRolesUpsert).toHaveBeenCalledWith(
            { user_id: 'user-1', biz_id: 'biz-1', role_id: 'role-staff' },
            { onConflict: 'user_id,role_id,biz_key' },
        );
        expect(result).toEqual({ ok: true });
    });
});
