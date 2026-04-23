import { GET } from '@/app/admin/api/metrics/auth-flow/route';
import { getServiceClient } from '@/lib/supabaseService';
import {
    createMockRequest,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/admin/metrics/auth-flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns auth flow dashboard stats for current and previous windows', async () => {
        const counts = [10, 7, 2, 1, 8, 6, 1, 1];
        let callIndex = 0;

        (getServiceClient as jest.Mock).mockReturnValue({
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        gte: jest.fn().mockReturnValue({
                            lt: jest.fn().mockImplementation(() =>
                                Promise.resolve({
                                    count: counts[callIndex++] ?? 0,
                                    error: null,
                                }),
                            ),
                        }),
                    }),
                }),
            }),
        });

        const req = createMockRequest(
            'http://localhost/api/admin/metrics/auth-flow?windowHours=24',
            { method: 'GET' },
        );

        const res = await GET(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('data.windowHours', 24);
        expect(data).toHaveProperty('data.current.started', 10);
        expect(data).toHaveProperty('data.current.approved', 7);
        expect(data).toHaveProperty('data.current.expired', 2);
        expect(data).toHaveProperty('data.current.failed', 1);
        expect(data).toHaveProperty('data.current.approvedRate', 0.7);
        expect(data).toHaveProperty('data.previous.started', 8);
        expect(data).toHaveProperty('data.previous.approved', 6);
    });

    test('returns validation error when windowHours is out of range', async () => {
        const req = createMockRequest(
            'http://localhost/api/admin/metrics/auth-flow?windowHours=999',
            { method: 'GET' },
        );

        const res = await GET(req);
        await expectErrorResponse(res, 400, 'validation');
    });
});
