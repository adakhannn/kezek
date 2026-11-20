import { POST } from '@/app/api/staff/[id]/invitation/cancel/route';
import {
    createMockRequest,
    createTableMock,
    expectBusinessScoped,
    expectErrorResponse,
    expectSuccessResponse,
} from '../testHelpers';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

// API-06: a manager cancels the pending invitation of a card of their business.
describe('/api/staff/[id]/invitation/cancel', () => {
    const staffId = '11111111-1111-4111-8111-111111111111';
    const bizId = '22222222-2222-4222-8222-222222222222';

    const cancel = () => POST(
        createMockRequest(`http://localhost/api/staff/${staffId}/invitation/cancel`, { method: 'POST' }),
        { params: Promise.resolve({ id: staffId }) },
    );

    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId, userId: 'manager-id' });
    });

    test('401 without a session, nothing is changed', async () => {
        const { BizAccessError } = await import('@/lib/authDiagnostics');
        (getBizContextForManagers as jest.Mock).mockRejectedValue(new BizAccessError('NOT_AUTHENTICATED', 'UNAUTHORIZED'));
        const admin = createTableMock();
        (getServiceClient as jest.Mock).mockReturnValue(admin);

        await expectErrorResponse(await cancel(), 401, 'auth');
        expect(admin.queries).toHaveLength(0);
    });

    test('403 without manager access to a business, nothing is changed', async () => {
        const { BizAccessError } = await import('@/lib/authDiagnostics');
        (getBizContextForManagers as jest.Mock).mockRejectedValue(new BizAccessError('NO_BIZ_ACCESS'));
        const admin = createTableMock();
        (getServiceClient as jest.Mock).mockReturnValue(admin);

        await expectErrorResponse(await cancel(), 403, 'forbidden');
        expect(admin.queries).toHaveLength(0);
    });

    test('cancels the pending invitation of this card in this business', async () => {
        const admin = createTableMock({ staff_invitations: { data: [{ id: 'inv-id' }] } });
        (getServiceClient as jest.Mock).mockReturnValue(admin);

        const data = await expectSuccessResponse(await cancel(), 200);

        expect(data).toMatchObject({ invitation_id: 'inv-id' });
        expectBusinessScoped(admin, 'staff_invitations', bizId);
        expect(admin.queries).toHaveLength(1);
        const [query] = admin.queries;
        expect(query.calls).toEqual(expect.arrayContaining([
            ['eq', 'staff_id', staffId],
            ['eq', 'status', 'pending'],
        ]));
        const update = query.calls.find(([method]) => method === 'update')?.[1] as Record<string, unknown>;
        expect(update.status).toBe('cancelled');
        expect(typeof update.decided_at).toBe('string');
        // The card itself is not touched: it stays, unlinked.
        expect(admin.queries.map((recorded) => recorded.table)).not.toContain('staff');
    });

    test('404 when the card has no pending invitation in this business', async () => {
        const admin = createTableMock({ staff_invitations: { data: [] } });
        (getServiceClient as jest.Mock).mockReturnValue(admin);

        const body = await expectErrorResponse(await cancel(), 404, 'not_found');
        expect(body.message).toBe('У этого сотрудника нет ожидающего приглашения');
        expectBusinessScoped(admin, 'staff_invitations', bizId);
    });

    test('500 when the update fails', async () => {
        const admin = createTableMock({ staff_invitations: { error: { message: 'timeout' } } });
        (getServiceClient as jest.Mock).mockReturnValue(admin);

        await expectErrorResponse(await cancel(), 500, 'internal');
    });
});
