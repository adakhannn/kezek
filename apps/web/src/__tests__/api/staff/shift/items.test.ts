import { POST } from '@/app/api/staff/shift/items/route';

jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((_req, _config, handler) => handler()),
    RateLimitConfigs: { normal: {} },
}));

jest.mock('@/lib/apiMetrics', () => ({
    logApiMetric: jest.fn(() => Promise.resolve()),
    getIpAddress: jest.fn(() => '127.0.0.1'),
    determineErrorType: jest.fn(() => null),
}));

jest.mock('@/lib/time', () => ({
    TZ: 'Asia/Bishkek',
    formatDateInTz: jest.fn(() => '2024-01-26'),
}));

import { getStaffContext } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

type QueryResult = { data: unknown; error: unknown };

function createListQuery(result: QueryResult) {
    const query: Record<string, jest.Mock> = {};
    const chain = () => query;
    query.select = jest.fn(chain);
    query.eq = jest.fn(chain);
    query.lte = jest.fn(chain);
    query.gte = jest.fn(chain);
    query.neq = jest.fn(chain);
    query.in = jest.fn(chain);
    query.order = jest.fn(chain);
    query.then = jest.fn((resolve: (value: QueryResult) => unknown) => Promise.resolve(resolve(result)));
    return query;
}

function createMaybeSingleQuery(result: QueryResult) {
    const query: Record<string, jest.Mock> = {};
    const chain = () => query;
    query.select = jest.fn(chain);
    query.eq = jest.fn(chain);
    query.lte = jest.fn(chain);
    query.gte = jest.fn(chain);
    query.neq = jest.fn(chain);
    query.in = jest.fn(chain);
    query.order = jest.fn(chain);
    query.maybeSingle = jest.fn().mockResolvedValue(result);
    return query;
}

function createInsertQuery(result: QueryResult) {
    return {
        insert: jest.fn().mockResolvedValue(result),
    };
}

function createUpdateQuery(result: QueryResult) {
    return {
        update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue(result),
        }),
    };
}

function createDeleteQuery(result: QueryResult) {
    return {
        delete: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue(result),
        }),
    };
}

describe('/api/staff/shift/items', () => {
    const mockSupabase = {
        auth: {
            getUser: jest.fn().mockResolvedValue({
                data: { user: { id: 'user-1' } },
                error: null,
            }),
        },
        from: jest.fn(),
    };

    const mockAdmin = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();

        (getStaffContext as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            staffId: 'staff-1',
            bizId: 'biz-1',
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    test('saves items for an open shift and recalculates totals', async () => {
        mockSupabase.from
            .mockReturnValueOnce(
                createMaybeSingleQuery({
                    data: { percent_master: 60, percent_salon: 40 },
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createMaybeSingleQuery({
                    data: { id: 'shift-1', status: 'open', shift_date: '2024-01-26' },
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createListQuery({
                    data: [],
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createInsertQuery({
                    data: [],
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createListQuery({
                    data: [
                        { service_amount: 1000, consumables_amount: 100 },
                        { service_amount: 2000, consumables_amount: 200 },
                    ],
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createUpdateQuery({
                    data: { id: 'shift-1' },
                    error: null,
                }),
            );

        const req = new Request('http://localhost/api/staff/shift/items', {
            method: 'POST',
            body: JSON.stringify({
                items: [
                    {
                        clientName: 'Ivan Ivanov',
                        serviceName: 'Haircut',
                        serviceAmount: 1000,
                        consumablesAmount: 100,
                    },
                    {
                        clientName: 'Petr Petrov',
                        serviceName: 'Coloring',
                        serviceAmount: 2000,
                        consumablesAmount: 200,
                    },
                ],
            }),
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
        expect(mockSupabase.from).toHaveBeenCalledWith('staff_shift_items');
        expect(mockSupabase.from).toHaveBeenCalledWith('staff_shifts');
    });

    test('accepts an empty item list and updates shift totals to zero', async () => {
        mockSupabase.from
            .mockReturnValueOnce(
                createMaybeSingleQuery({
                    data: { percent_master: 60, percent_salon: 40 },
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createMaybeSingleQuery({
                    data: { id: 'shift-1', status: 'open', shift_date: '2024-01-26' },
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createListQuery({
                    data: [],
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createListQuery({
                    data: [],
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createUpdateQuery({
                    data: { id: 'shift-1' },
                    error: null,
                }),
            );

        const req = new Request('http://localhost/api/staff/shift/items', {
            method: 'POST',
            body: JSON.stringify({ items: [] }),
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.ok).toBe(true);
    });

    test('returns validation error when items are missing', async () => {
        const req = new Request('http://localhost/api/staff/shift/items', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('validation');
    });

    test('returns validation error when there is no open shift', async () => {
        mockSupabase.from
            .mockReturnValueOnce(
                createMaybeSingleQuery({
                    data: { percent_master: 60, percent_salon: 40 },
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createMaybeSingleQuery({
                    data: null,
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createMaybeSingleQuery({
                    data: null,
                    error: null,
                }),
            );

        const req = new Request('http://localhost/api/staff/shift/items', {
            method: 'POST',
            body: JSON.stringify({
                items: [
                    {
                        clientName: 'Ivan Ivanov',
                        serviceName: 'Haircut',
                        serviceAmount: 1000,
                    },
                ],
            }),
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('validation');
    });

    test('returns internal error when insert fails', async () => {
        mockSupabase.from
            .mockReturnValueOnce(
                createMaybeSingleQuery({
                    data: { percent_master: 60, percent_salon: 40 },
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createMaybeSingleQuery({
                    data: { id: 'shift-1', status: 'open', shift_date: '2024-01-26' },
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createListQuery({
                    data: [],
                    error: null,
                }),
            )
            .mockReturnValueOnce(
                createInsertQuery({
                    data: null,
                    error: { message: 'insert failed' },
                }),
            );

        const req = new Request('http://localhost/api/staff/shift/items', {
            method: 'POST',
            body: JSON.stringify({
                items: [
                    {
                        clientName: 'Ivan Ivanov',
                        serviceName: 'Haircut',
                        serviceAmount: 1000,
                    },
                ],
            }),
        });

        const response = await POST(req);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.ok).toBe(false);
        expect(data.error).toBe('internal');
    });
});
