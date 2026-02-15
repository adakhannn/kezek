/**
 * Тесты для /api/reviews/update
 * Обновление отзыва
 */

import { POST } from '@/app/api/reviews/update/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

// Мокаем supabaseHelpers
jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

describe('/api/reviews/update', () => {
    const mockSupabase = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
    });

    describe('Авторизация', () => {
        test('должен вернуть 401 если пользователь не авторизован', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: null,
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/reviews/update', {
                method: 'POST',
                body: {
                    review_id: 'review-id',
                    rating: 5,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 401, 'UNAUTHORIZED');
        });
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии обязательных полей', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/reviews/update', {
                method: 'POST',
                body: {
                    // Отсутствует review_id или rating
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'BAD_REQUEST');
        });

        test('должен вернуть 400 при отсутствии review_id', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/reviews/update', {
                method: 'POST',
                body: {
                    rating: 5,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'BAD_REQUEST');
        });

        test('должен вернуть 400 при отсутствии rating', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/reviews/update', {
                method: 'POST',
                body: {
                    review_id: 'review-id',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'BAD_REQUEST');
        });
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 404 если отзыв не найден', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/reviews/update', {
                method: 'POST',
                body: {
                    review_id: 'non-existent-review',
                    rating: 5,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 404, 'REVIEW_NOT_FOUND');
        });

        test('должен вернуть 403 если отзыв принадлежит другому пользователю', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'review-id',
                        client_id: 'other-user-id',
                        booking_id: 'booking-id',
                    },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/reviews/update', {
                method: 'POST',
                body: {
                    review_id: 'review-id',
                    rating: 5,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 403, 'FORBIDDEN');
        });
    });

    describe('Успешное обновление', () => {
        test('должен успешно обновить отзыв', async () => {
            const userId = 'user-id';
            const reviewId = 'review-id';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            // Мокаем проверку отзыва
            let callCount = 0;
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'reviews') {
                    if (callCount === 0) {
                        callCount++;
                        // Проверка существования отзыва
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockReturnThis(),
                            maybeSingle: jest.fn().mockResolvedValue({
                                data: {
                                    id: reviewId,
                                    client_id: userId,
                                    booking_id: 'booking-id',
                                },
                                error: null,
                            }),
                        };
                    } else {
                        // Обновление отзыва
                        return {
                            update: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockReturnThis(),
                            select: jest.fn().mockReturnThis(),
                            single: jest.fn().mockResolvedValue({
                                data: {
                                    id: reviewId,
                                },
                                error: null,
                            }),
                        };
                    }
                }
                return mockSupabase;
            });

            const req = createMockRequest('http://localhost/api/reviews/update', {
                method: 'POST',
                body: {
                    review_id: reviewId,
                    rating: 4,
                    comment: 'Updated comment',
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('id', reviewId);
        });
    });
});

