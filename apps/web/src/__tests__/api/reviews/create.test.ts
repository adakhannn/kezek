import { POST } from '@/app/api/reviews/create/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

const BOOKING_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = 'user-22222222-2222-2222-2222-222222222222';
const REVIEW_ID = 'review-11111111-1111-1111-1111-111111111111';

describe('/api/reviews/create', () => {
    const mockSupabase = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();
        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
    });

    test('returns 401 for unauthenticated user', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/reviews/create', {
            method: 'POST',
            body: { booking_id: BOOKING_ID, rating: 5 },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 401, 'auth');
    });

    test('returns 400 when required fields are missing', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: USER_ID } },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/reviews/create', {
            method: 'POST',
            body: {},
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'validation');
    });

    test('returns 404 when booking does not exist', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: USER_ID } },
            error: null,
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'bookings') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                };
            }

            return mockSupabase;
        });

        const req = createMockRequest('http://localhost/api/reviews/create', {
            method: 'POST',
            body: { booking_id: BOOKING_ID, rating: 5 },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 404, 'not_found');
    });

    test('returns 403 when booking belongs to another client', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: USER_ID } },
            error: null,
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'bookings') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: BOOKING_ID, client_id: OTHER_USER_ID, status: 'completed' },
                        error: null,
                    }),
                };
            }

            return mockSupabase;
        });

        const req = createMockRequest('http://localhost/api/reviews/create', {
            method: 'POST',
            body: { booking_id: BOOKING_ID, rating: 5 },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 403, 'forbidden');
    });

    test('creates a new review when none exists', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: USER_ID } },
            error: null,
        });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'bookings') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: BOOKING_ID, client_id: USER_ID, status: 'completed' },
                        error: null,
                    }),
                };
            }

            if (table === 'reviews') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: null,
                        error: null,
                    }),
                    insert: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: { id: REVIEW_ID },
                        error: null,
                    }),
                };
            }

            return mockSupabase;
        });

        const req = createMockRequest('http://localhost/api/reviews/create', {
            method: 'POST',
            body: { booking_id: BOOKING_ID, rating: 5, comment: 'Great service' },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data.id).toBe(REVIEW_ID);
        expect(data.updated).toBe(false);
    });

    test('updates existing review for same client', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: USER_ID } },
            error: null,
        });

        let reviewsCall = 0;
        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'bookings') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: BOOKING_ID, client_id: USER_ID, status: 'completed' },
                        error: null,
                    }),
                };
            }

            if (table === 'reviews' && reviewsCall === 0) {
                reviewsCall += 1;
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: REVIEW_ID, client_id: USER_ID },
                        error: null,
                    }),
                };
            }

            if (table === 'reviews') {
                return {
                    update: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    select: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: { id: REVIEW_ID },
                        error: null,
                    }),
                };
            }

            return mockSupabase;
        });

        const req = createMockRequest('http://localhost/api/reviews/create', {
            method: 'POST',
            body: { booking_id: BOOKING_ID, rating: 4, comment: 'Updated comment' },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data.id).toBe(REVIEW_ID);
        expect(data.updated).toBe(true);
    });

    test('returns 409 when review exists for another client', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: USER_ID } },
            error: null,
        });

        let reviewsCall = 0;
        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'bookings') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: BOOKING_ID, client_id: USER_ID, status: 'completed' },
                        error: null,
                    }),
                };
            }

            if (table === 'reviews' && reviewsCall === 0) {
                reviewsCall += 1;
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: REVIEW_ID, client_id: OTHER_USER_ID },
                        error: null,
                    }),
                };
            }

            return mockSupabase;
        });

        const req = createMockRequest('http://localhost/api/reviews/create', {
            method: 'POST',
            body: { booking_id: BOOKING_ID, rating: 5 },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 409, 'conflict');
    });
});
