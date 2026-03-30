import { logDebug, logWarn } from '@/lib/log';
import {
    buildNoBizAccessDiagnostics,
    checkIsSuperAdmin,
    createServiceRoleClientWithFallback,
    getBizResolutionMethod,
} from '@/lib/bizContextRuntimeHelpers';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
    logDebug: jest.fn(),
    logWarn: jest.fn(),
}));

describe('bizContextRuntimeHelpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createServiceRoleClientWithFallback', () => {
        it('returns admin client when service role key is available', () => {
            const serverClient = { kind: 'server' } as never;
            const adminClient = { kind: 'admin' };
            (createSupabaseAdminClient as jest.Mock).mockReturnValue(adminClient);

            const result = createServiceRoleClientWithFallback({
                scope: 'TestScope',
                serverClient,
                missingKeyMessage: 'service role missing',
            });

            expect(result).toBe(adminClient);
        });

        it('falls back to server client and logs warning when admin client creation fails', () => {
            const serverClient = { kind: 'server' } as never;
            (createSupabaseAdminClient as jest.Mock).mockImplementation(() => {
                throw new Error('missing key');
            });

            const result = createServiceRoleClientWithFallback({
                scope: 'TestScope',
                serverClient,
                missingKeyMessage: 'service role missing',
            });

            expect(result).toBe(serverClient);
            expect(logWarn).toHaveBeenCalledWith('TestScope', 'service role missing', {
                error: 'missing key',
            });
        });
    });

    describe('checkIsSuperAdmin', () => {
        it('returns true when rpc resolves truthy result', async () => {
            const supabase = {
                rpc: jest.fn().mockResolvedValue({ data: true, error: null }),
            } as never;

            await expect(checkIsSuperAdmin({ supabase, userId: 'user-1' })).resolves.toBe(true);
            expect(logDebug).toHaveBeenCalledWith('AuthBiz', 'Checking super admin status via RPC', {
                userId: 'user-1',
            });
        });

        it('returns false and logs warning when rpc returns error payload', async () => {
            const supabase = {
                rpc: jest.fn().mockResolvedValue({
                    data: false,
                    error: { message: 'rpc failed', code: 'PGRST', details: 'details' },
                }),
            } as never;

            await expect(checkIsSuperAdmin({ supabase, userId: 'user-2' })).resolves.toBe(false);
            expect(logWarn).toHaveBeenCalledWith(
                'AuthBiz',
                'RPC is_super_admin error (non-critical)',
                expect.objectContaining({
                    error: 'rpc failed',
                    errorCode: 'PGRST',
                    userId: 'user-2',
                }),
            );
        });

        it('returns false when rpc throws', async () => {
            const supabase = {
                rpc: jest.fn().mockRejectedValue(new Error('rpc unavailable')),
            } as never;

            await expect(checkIsSuperAdmin({ supabase, userId: 'user-3' })).resolves.toBe(false);
            expect(logWarn).toHaveBeenCalledWith(
                'AuthBiz',
                'RPC is_super_admin not available (non-critical)',
                expect.objectContaining({
                    error: 'rpc unavailable',
                    userId: 'user-3',
                }),
            );
        });
    });

    describe('buildNoBizAccessDiagnostics', () => {
        it('maps diagnostics into stable error payload with defaults', () => {
            expect(
                buildNoBizAccessDiagnostics({
                    checkedSuperAdmin: true,
                    checkedUserRoles: false,
                    checkedOwnerId: false,
                }),
            ).toEqual({
                checkedSuperAdmin: true,
                checkedUserRoles: false,
                checkedOwnerId: false,
                currentBizId: null,
                hasCurrentBizRecord: false,
                currentBizHasAllowedRole: false,
                userRolesFound: 0,
                eligibleRolesFound: 0,
                ownedBusinessesFound: 0,
                errorsCount: 0,
            });
        });
    });

    describe('getBizResolutionMethod', () => {
        it('prefers super_admin resolution', () => {
            expect(
                getBizResolutionMethod({
                    isSuper: true,
                    diagnostics: {
                        checkedSuperAdmin: true,
                        checkedUserRoles: false,
                        checkedOwnerId: false,
                    },
                }),
            ).toBe('super_admin');
        });

        it('returns current_biz when current business is valid', () => {
            expect(
                getBizResolutionMethod({
                    isSuper: false,
                    diagnostics: {
                        checkedSuperAdmin: false,
                        checkedUserRoles: false,
                        checkedOwnerId: false,
                        hasCurrentBizRecord: true,
                        currentBizHasAllowedRole: true,
                    },
                }),
            ).toBe('current_biz');
        });

        it('returns user_roles when eligible manager roles were found', () => {
            expect(
                getBizResolutionMethod({
                    isSuper: false,
                    diagnostics: {
                        checkedSuperAdmin: false,
                        checkedUserRoles: true,
                        checkedOwnerId: false,
                        eligibleRolesCount: 2,
                    },
                }),
            ).toBe('user_roles');
        });

        it('falls back to owner_id when no higher-priority path matched', () => {
            expect(
                getBizResolutionMethod({
                    isSuper: false,
                    diagnostics: {
                        checkedSuperAdmin: false,
                        checkedUserRoles: true,
                        checkedOwnerId: true,
                        eligibleRolesCount: 0,
                    },
                }),
            ).toBe('owner_id');
        });
    });
});
