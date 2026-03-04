/**
 * Тесты для withManagerContext: успешный доступ, 401 при NOT_AUTHENTICATED, 403 при NO_BIZ_ACCESS.
 */

import { NextRequest } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { withManagerContext } from '@/lib/withManagerContext';
import { createSuccessResponse } from '@/lib/apiErrorHandler';
import { BizAccessError } from '@/lib/authDiagnostics';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(() => ({ _admin: true })),
}));

describe('withManagerContext', () => {
    const req = new NextRequest('http://localhost/api/test');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('calls handler with context and returns handler result on success', async () => {
        getBizContextForManagers.mockResolvedValue({
            supabase: { _server: true },
            userId: 'user-1',
            bizId: 'biz-1',
        });

        const result = await withManagerContext(req, 'TestScope', async (ctx) => {
            expect(ctx.bizId).toBe('biz-1');
            expect(ctx.userId).toBe('user-1');
            expect(ctx.supabase).toEqual({ _server: true });
            expect(ctx.admin).toEqual({ _admin: true });
            return createSuccessResponse({ ok: true });
        });

        expect(result.status).toBe(200);
        const json = await result.json();
        expect(json.ok).toBe(true);
    });

    it('returns 401 when getBizContextForManagers throws NOT_AUTHENTICATED', async () => {
        getBizContextForManagers.mockRejectedValue(new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED'));

        const result = await withManagerContext(req, 'TestScope', async () => createSuccessResponse({}));

        expect(result.status).toBe(401);
        const json = await result.json();
        expect(json.ok).toBe(false);
        expect(json.error).toBe('auth');
    });

    it('returns 403 when getBizContextForManagers throws NO_BIZ_ACCESS', async () => {
        getBizContextForManagers.mockRejectedValue(new BizAccessError('NO_BIZ_ACCESS'));

        const result = await withManagerContext(req, 'TestScope', async () => createSuccessResponse({}));

        expect(result.status).toBe(403);
        const json = await result.json();
        expect(json.ok).toBe(false);
        expect(json.error).toBe('forbidden');
    });

    it('rethrows non-BizAccessError', async () => {
        getBizContextForManagers.mockRejectedValue(new Error('Network error'));

        await expect(
            withManagerContext(req, 'TestScope', async () => createSuccessResponse({}))
        ).rejects.toThrow('Network error');
    });
});
