import { BizAccessError } from '@/lib/authDiagnostics';
import { logWarn } from '@/lib/log';
import { resolveStaffContext } from '@/lib/staffRoleSync';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
    logWarn: jest.fn(),
}));

function createFilterChain(result: unknown) {
    const chain: any = {
        select: jest.fn(() => chain),
        eq: jest.fn(() => chain),
        maybeSingle: jest.fn().mockResolvedValue({ data: result, error: null }),
    };
    return chain;
}

function createInsertChain(error: { message: string } | null = null) {
    return {
        insert: jest.fn().mockResolvedValue({ error }),
    };
}

describe('resolveStaffContext', () => {
    const serverClient: any = {
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(),
    };
    const adminClient: any = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (createSupabaseServerClient as jest.Mock).mockResolvedValue(serverClient);
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(adminClient);
        serverClient.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });
    });

    it('throws NOT_AUTHENTICATED when user is missing', async () => {
        serverClient.auth.getUser.mockResolvedValueOnce({
            data: { user: null },
            error: null,
        });

        await expect(resolveStaffContext()).rejects.toMatchObject<Partial<BizAccessError>>({
            code: 'NOT_AUTHENTICATED',
        });
    });

    it('throws NO_STAFF_RECORD when active staff row is missing', async () => {
        serverClient.from.mockReturnValueOnce(createFilterChain(null));

        await expect(resolveStaffContext()).rejects.toMatchObject<Partial<BizAccessError>>({
            code: 'NO_STAFF_RECORD',
        });
    });

    it('returns context when staff role already exists', async () => {
        serverClient.from.mockReturnValueOnce(
            createFilterChain({
                id: 'staff-1',
                biz_id: 'biz-1',
                branch_id: 'branch-1',
            }),
        );
        adminClient.from
            .mockReturnValueOnce(createFilterChain({ id: 'role-staff' }))
            .mockReturnValueOnce(createFilterChain({ id: 'existing-role' }));

        const result = await resolveStaffContext();

        expect(result).toEqual({
            supabase: serverClient,
            userId: 'user-1',
            staffId: 'staff-1',
            bizId: 'biz-1',
            branchId: 'branch-1',
        });
    });

    it('inserts missing staff role assignment', async () => {
        serverClient.from.mockReturnValueOnce(
            createFilterChain({
                id: 'staff-2',
                biz_id: 'biz-2',
                branch_id: null,
            }),
        );

        const insertChain = createInsertChain();
        adminClient.from
            .mockReturnValueOnce(createFilterChain({ id: 'role-staff' }))
            .mockReturnValueOnce(createFilterChain(null))
            .mockReturnValueOnce(insertChain);

        const result = await resolveStaffContext();

        expect(result.branchId).toBeNull();
        expect(insertChain.insert).toHaveBeenCalledWith({
            user_id: 'user-1',
            biz_id: 'biz-2',
            role_id: 'role-staff',
            biz_key: 'biz-2',
        });
    });

    it('falls back to server client when service role client is unavailable', async () => {
        serverClient.from
            .mockReturnValueOnce(
                createFilterChain({
                    id: 'staff-3',
                    biz_id: 'biz-3',
                    branch_id: 'branch-3',
                }),
            )
            .mockReturnValueOnce(createFilterChain({ id: 'role-staff' }))
            .mockReturnValueOnce(createFilterChain({ id: 'existing-role' }));
        (createSupabaseAdminClient as jest.Mock).mockImplementation(() => {
            throw new Error('missing service role key');
        });

        const result = await resolveStaffContext();

        expect(result.bizId).toBe('biz-3');
        expect(logWarn).toHaveBeenCalledWith(
            'AuthBiz',
            'SUPABASE_SERVICE_ROLE_KEY not set, using server client (RLS)',
            { error: 'missing service role key' },
        );
    });

    it('logs warning but still returns context when role insert fails', async () => {
        serverClient.from.mockReturnValueOnce(
            createFilterChain({
                id: 'staff-4',
                biz_id: 'biz-4',
                branch_id: 'branch-4',
            }),
        );

        adminClient.from
            .mockReturnValueOnce(createFilterChain({ id: 'role-staff' }))
            .mockReturnValueOnce(createFilterChain(null))
            .mockReturnValueOnce(createInsertChain({ message: 'insert failed' }));

        const result = await resolveStaffContext();

        expect(result.staffId).toBe('staff-4');
        expect(logWarn).toHaveBeenCalledWith('AuthBiz', 'Failed to auto-add staff role', {
            message: 'insert failed',
        });
    });
});
