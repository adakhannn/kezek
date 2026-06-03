jest.mock('@/lib/authBiz', () => ({
    getStaffContextForRequest: jest.fn(),
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

jest.mock('@/lib/staffShiftItemsService', () => ({
    runSaveStaffShiftItems: jest.fn(),
}));

import { getBizContextForManagers, getStaffContextForRequest } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { runSaveStaffShiftItems } from '@/lib/staffShiftItemsService';
import { getServiceClient } from '@/lib/supabaseService';
import { runStaffShiftItemsRoute } from '@/lib/staffShiftItemsRouteService';

describe('staffShiftItemsRouteService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns validation error for invalid payload', async () => {
        const req = new Request('http://localhost/api/staff/shift/items', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const result = await runStaffShiftItemsRoute(req);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error).toBe('validation');
        expect(result.status).toBe(400);
    });

    test('resolves staff context and delegates save flow', async () => {
        (getStaffContextForRequest as jest.Mock).mockResolvedValue({
            supabase: { auth: { getUser: jest.fn() } },
            staffId: 'staff-1',
            bizId: 'biz-1',
            userId: 'user-1',
        });
        (runSaveStaffShiftItems as jest.Mock).mockResolvedValue({ ok: true });

        const req = new Request('http://localhost/api/staff/shift/items', {
            method: 'POST',
            body: JSON.stringify({
                items: [],
            }),
        });

        const result = await runStaffShiftItemsRoute(req);

        expect(runSaveStaffShiftItems).toHaveBeenCalledWith({
            supabase: { auth: { getUser: expect.any(Function) } },
            staffId: 'staff-1',
            bizId: 'biz-1',
            items: [],
            targetShiftDate: undefined,
            isOwnerMode: false,
            useServiceClient: false,
        });
        expect(result).toEqual({
            ok: true,
            metric: {
                staffId: 'staff-1',
                bizId: 'biz-1',
                userId: 'user-1',
            },
        });
    });

    test('blocks manager mode when target staff is outside business', async () => {
        const supabase = {
            auth: {
                getUser: jest.fn().mockResolvedValue({
                    data: { user: { id: 'manager-1' } },
                }),
            },
        };
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase,
            bizId: 'biz-1',
        });
        (getServiceClient as jest.Mock).mockReturnValue({});
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: null,
            error: null,
        });

        const req = new Request('http://localhost/api/staff/shift/items', {
            method: 'POST',
            body: JSON.stringify({
                staffId: '11111111-1111-4111-8111-111111111112',
                items: [],
            }),
        });

        const result = await runStaffShiftItemsRoute(req);

        expect(result).toEqual({
            ok: false,
            error: 'forbidden',
            message: 'Сотрудник не принадлежит этому бизнесу',
            status: 403,
            metric: {
                staffId: '11111111-1111-4111-8111-111111111112',
                bizId: 'biz-1',
                userId: 'manager-1',
            },
        });
    });
});
