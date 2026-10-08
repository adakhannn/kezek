import { staffTimeOffHttp } from '@/lib/scheduling/timeOffServer';
import { BizAccessError, getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/scheduling/config', () => ({ explicitSchedulingEnabled: () => true }));
jest.mock('@/lib/authBiz', () => ({
    BizAccessError: jest.requireActual('@/lib/authDiagnostics').BizAccessError,
    getBizContextForManagers: jest.fn(),
}));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));

const staffId = '11111111-1111-4111-8111-111111111111';
const bizId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';

function query(final: string, result: unknown) {
    const chain: Record<string, jest.Mock> = {};
    for (const name of ['select', 'eq', 'is', 'order', 'limit', 'insert', 'update', 'maybeSingle', 'single']) {
        chain[name] = jest.fn().mockReturnValue(chain);
    }
    chain[final].mockResolvedValue(result);
    return chain;
}

describe('staff absence manager endpoint', () => {
    let from: jest.Mock;
    beforeEach(() => {
        jest.clearAllMocks();
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId, userId: actorId });
        from = jest.fn((table: string) => {
            if (table === 'staff') return query('maybeSingle', { data: { id: staffId }, error: null });
            if (table === 'businesses') return query('single', { data: { tz: 'Asia/Bishkek' }, error: null });
            throw new Error(`Unexpected table: ${table}`);
        });
        (getServiceClient as jest.Mock).mockReturnValue({ from });
    });

    test('rejects unauthenticated and unknown staff before a write', async () => {
        (getBizContextForManagers as jest.Mock).mockRejectedValueOnce(new BizAccessError('NOT_AUTHENTICATED'));
        const denied = await staffTimeOffHttp(new Request('http://localhost/api', { method: 'POST', body: '{}' }), staffId);
        expect(denied.status).toBe(401);
        expect(from).not.toHaveBeenCalled();
        from.mockImplementationOnce(() => query('maybeSingle', { data: null, error: null }));
        const missing = await staffTimeOffHttp(new Request('http://localhost/api', { method: 'POST', body: '{}' }), staffId);
        expect(missing.status).toBe(404);
    });

    test('rejects invalid dates without inserting', async () => {
        const response = await staffTimeOffHttp(new Request('http://localhost/api', { method: 'POST',
            body: JSON.stringify({ from: '2099-01-10', to: '2099-01-09' }) }), staffId);
        expect(response.status).toBe(400);
        expect(from).not.toHaveBeenCalledWith('staff_time_off');
    });

    test('reports booking conflict without creating absence', async () => {
        const insertion = query('single', { data: null, error: { message: 'SCHEDULE_BOOKING_CONFLICT' } });
        from.mockImplementation((table: string) => table === 'staff_time_off' ? insertion :
            table === 'staff' ? query('maybeSingle', { data: { id: staffId }, error: null }) :
                query('single', { data: { tz: 'Asia/Bishkek' }, error: null }));
        const response = await staffTimeOffHttp(new Request('http://localhost/api', { method: 'POST',
            body: JSON.stringify({ from: '2099-01-10', to: '2099-01-11' }) }), staffId);
        expect(response.status).toBe(409);
        expect(insertion.insert).toHaveBeenCalledWith(expect.objectContaining({ created_by: actorId, staff_id: staffId }));
    });
});
