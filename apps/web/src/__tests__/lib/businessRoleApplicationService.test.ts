import {
    canBusinessManagerApproveRole,
    submitBusinessRoleApplication,
} from '@/lib/businessRoleApplicationService';

describe('businessRoleApplicationService role policy', () => {
    test.each(['admin', 'manager'] as const)('rejects new %s applications', async (requestedRole) => {
        const admin = { from: jest.fn() };

        const result = await submitBusinessRoleApplication({
            admin,
            user: { id: 'user-1' },
            input: {
                biz_id: 'biz-1',
                requested_role: requestedRole,
                message: 'test',
            },
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            code: 'unsupported_role',
            message: 'Сейчас можно отправить заявку только на роль владельца или сотрудника.',
        });
        expect(admin.from).not.toHaveBeenCalled();
    });

    test('business owners can approve only staff applications', () => {
        expect(canBusinessManagerApproveRole('staff')).toBe(true);
        expect(canBusinessManagerApproveRole('owner')).toBe(false);
        expect(canBusinessManagerApproveRole('admin')).toBe(false);
        expect(canBusinessManagerApproveRole('manager')).toBe(false);
    });

    test('requires proof for owner applications before querying the database', async () => {
        const admin = { from: jest.fn(), rpc: jest.fn() };

        const result = await submitBusinessRoleApplication({
            admin,
            user: { id: 'user-1' },
            input: {
                biz_id: 'biz-1',
                requested_role: 'owner',
                message: 'коротко',
            },
        });

        expect(result).toMatchObject({
            ok: false,
            status: 400,
            code: 'owner_evidence_required',
        });
        expect(admin.from).not.toHaveBeenCalled();
    });

    test('submits owner proof with the versioned policy contract', async () => {
        const query = (data: unknown) => {
            const chain: Record<string, jest.Mock> = {};
            for (const method of ['select', 'eq', 'insert']) chain[method] = jest.fn(() => chain);
            chain.maybeSingle = jest.fn().mockResolvedValue({ data, error: null });
            chain.single = jest.fn().mockResolvedValue({ data: { id: 'application-1' }, error: null });
            return chain;
        };
        const businessQuery = query({ id: 'biz-1', name: 'Test business' });
        const roleQuery = query({ id: 'role-owner' });
        const existingRoleQuery = query(null);
        const duplicateQuery = query(null);
        const insertQuery = query(null);
        let roleApplicationCall = 0;
        const admin = {
            rpc: jest.fn(),
            from: jest.fn((table: string) => {
                if (table === 'businesses') return businessQuery;
                if (table === 'roles') return roleQuery;
                if (table === 'user_roles') return existingRoleQuery;
                roleApplicationCall += 1;
                return roleApplicationCall === 1 ? duplicateQuery : insertQuery;
            }),
        };

        const result = await submitBusinessRoleApplication({
            admin,
            user: { id: 'user-1', email: 'owner@example.com' },
            input: {
                biz_id: 'biz-1',
                requested_role: 'owner',
                message: 'Я владелец и могу подтвердить бизнес.',
                evidence_links: { instagram: 'https://instagram.com/test-business' },
            },
        });

        expect(result).toEqual({ ok: true, id: 'application-1' });
        expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            evidence_links: { instagram: 'https://instagram.com/test-business' },
            policy_version: 1,
        }));
    });
});
