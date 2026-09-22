import {
    canBusinessManagerApproveRole,
    submitBusinessRoleApplication,
    loadBusinessRoleApplicant,
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

    test.each(['owner', 'staff'] as const)('submits %s with profile identity and the versioned policy contract', async (requestedRole) => {
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
                if (table === 'profiles') return query({ full_name: 'Saved profile name', phone: '+996222222222' });
                roleApplicationCall += 1;
                return roleApplicationCall === 1 ? duplicateQuery : insertQuery;
            }),
        };

        const result = await submitBusinessRoleApplication({
            admin,
            user: { id: 'user-1', email: 'owner@example.com' },
            input: {
                biz_id: 'biz-1',
                requested_role: requestedRole,
                message: requestedRole === 'owner' ? 'Я владелец и могу подтвердить бизнес.' : '',
                evidence_links: { instagram: 'https://instagram.com/test-business' },
            },
        });

        expect(result).toMatchObject({ ok: true, id: 'application-1' });
        expect(insertQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
            applicant_user_id: 'user-1',
            applicant_name: 'Saved profile name',
            applicant_phone: '+996222222222',
            message: requestedRole === 'owner' ? 'Я владелец и могу подтвердить бизнес.' : '',
            evidence_links: { instagram: 'https://instagram.com/test-business' },
            policy_version: 1,
        }));
        expect(result).toMatchObject({ applicant: { name: 'Saved profile name', email: 'owner@example.com', phone: '+996222222222' } });
    });
});

describe('application identity', () => {
    const user = { id: 'user-1', email: 'auth@example.com', phone: '+996111111111', user_metadata: { full_name: 'Old name' } };
    function db(data: unknown, error: unknown = null) {
        const chain = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data, error }) };
        return { from: jest.fn(() => chain), chain };
    }
    test('uses saved profile name and contact phone, scoped to the authenticated user', async () => {
        const client = db({ full_name: ' Profile name ', phone: ' +996222222222 ' });
        expect(await loadBusinessRoleApplicant(client, user)).toEqual({ name: 'Profile name', phone: '+996222222222', email: 'auth@example.com' });
        expect(client.chain.eq).toHaveBeenCalledWith('id', 'user-1');
    });
    test('falls back to login data when profile is missing or blank', async () => {
        for (const profile of [null, { full_name: ' ', phone: '' }]) {
            expect(await loadBusinessRoleApplicant(db(profile), user)).toEqual({ name: 'Old name', email: user.email, phone: user.phone });
        }
    });
    test('does not silently persist stale identity on a profile read failure', async () => {
        await expect(loadBusinessRoleApplicant(db(null, { message: 'failure' }), user)).rejects.toThrow('Не удалось загрузить');
    });
});
