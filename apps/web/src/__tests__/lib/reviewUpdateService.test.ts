import { runReviewUpdate } from '@/lib/reviewUpdateService';

describe('reviewUpdateService', () => {
    const supabase = {
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns auth error when user is missing', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const result = await runReviewUpdate({
            supabase,
            body: {
                review_id: 'review-1',
                rating: 5,
            },
        });

        expect(result).toEqual({
            ok: false,
            status: 401,
            error: 'auth',
            message: 'Не авторизован',
        });
    });

    test('returns not_found when review does not exist', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });
        supabase.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        });

        const result = await runReviewUpdate({
            supabase,
            body: {
                review_id: 'review-1',
                rating: 5,
            },
        });

        expect(result).toEqual({
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Отзыв не найден',
        });
    });

    test('updates review owned by current user', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });

        let call = 0;
        supabase.from.mockImplementation(() => {
            if (call === 0) {
                call += 1;
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: {
                            id: 'review-1',
                            client_id: 'user-1',
                            booking_id: 'booking-1',
                        },
                        error: null,
                    }),
                };
            }

            return {
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'review-1' },
                    error: null,
                }),
            };
        });

        const result = await runReviewUpdate({
            supabase,
            body: {
                review_id: 'review-1',
                rating: 4,
                comment: 'Updated',
            },
            now: '2026-03-27T10:00:00.000Z',
        });

        expect(result).toEqual({
            ok: true,
            payload: {
                id: 'review-1',
            },
        });
    });
});
