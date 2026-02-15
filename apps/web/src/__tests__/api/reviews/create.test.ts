/**
 * Тесты для /api/reviews/create
 * Создание отзыва на бронирование
 */

import { POST } from '@/app/api/reviews/create/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

// Мокаем supabaseHelpers
jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

describe('/api/reviews/create', () => {
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

            const req = createMockRequest('http://localhost/api/reviews/create', {
                method: 'POST',
                body: {
                    booking_id: 'booking-id',
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

            const req = createMockRequest('http://localhost/api/reviews/create', {
                method: 'POST',
                body: {
                    // Отсутствует booking_id или rating
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'BAD_REQUEST');
        });

        test('должен вернуть 400 при отсутствии booking_id', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/reviews/create', {
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

            const req = createMockRequest('http://localhost/api/reviews/create', {
                method: 'POST',
                body: {
                    booking_id: 'booking-id',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'BAD_REQUEST');
        });
    });

    describe('Проверка прав доступа', () => {
        test('должен вернуть 404 если бронирование не найдено', async () => {
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

            const req = createMockRequest('http://localhost/api/reviews/create', {
                method: 'POST',
                body: {
                    booking_id: 'non-existent-booking',
                    rating: 5,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 404, 'BOOKING_NOT_FOUND');
        });

        test('должен вернуть 403 если бронирование принадлежит другому пользователю', async () => {
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
                        id: 'booking-id',
                        client_id: 'other-user-id',
                        status: 'completed',
                    },
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/reviews/create', {
                method: 'POST',
                body: {
                    booking_id: 'booking-id',
                    rating: 5,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 403, 'FORBIDDEN');
        });
    });

    describe('Создание отзыва', () => {
        test('должен успешно создать новый отзыв', async () => {
            const userId = 'user-id';
            const bookingId = 'booking-id';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            // Мокаем проверку бронирования
            let callCount = 0;
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'bookings') {
                    if (callCount === 0) {
                        callCount++;
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockReturnThis(),
                            maybeSingle: jest.fn().mockResolvedValue({
                                data: {
                                    id: bookingId,
                                    client_id: userId,
                                    status: 'completed',
                                },
                                error: null,
                            }),
                        };
                    } else if (callCount === 1) {
                        callCount++;
                        // Проверка существующего отзыва
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockReturnThis(),
                            maybeSingle: jest.fn().mockResolvedValue({
                                data: null, // Отзыва еще нет
                                error: null,
                            }),
                        };
                    }
                } else if (table === 'reviews') {
                    // Создание отзыва
                    return {
                        insert: jest.fn().mockReturnThis(),
                        select: jest.fn().mockReturnThis(),
                        single: jest.fn().mockResolvedValue({
                            data: {
                                id: 'review-id',
                            },
                            error: null,
                        }),
                    };
                }
                return mockSupabase;
            });

            const req = createMockRequest('http://localhost/api/reviews/create', {
                method: 'POST',
                body: {
                    booking_id: bookingId,
                    rating: 5,
                    comment: 'Great service!',
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('id', 'review-id');
            expect(data).toHaveProperty('updated', false);
        });

        test('должен обновить существующий отзыв если он принадлежит пользователю', async () => {
            const userId = 'user-id';
            const bookingId = 'booking-id';
            const reviewId = 'review-id';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            // Мокаем проверку бронирования
            let callCount = 0;
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'bookings') {
                    callCount++;
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: {
                                id: bookingId,
                                client_id: userId,
                                status: 'completed',
                            },
                            error: null,
                        }),
                    };
                } else if (table === 'reviews') {
                    if (callCount === 1) {
                        callCount++;
                        // Проверка существующего отзыва
                        return {
                            select: jest.fn().mockReturnThis(),
                            eq: jest.fn().mockReturnThis(),
                            maybeSingle: jest.fn().mockResolvedValue({
                                data: {
                                    id: reviewId,
                                    client_id: userId,
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

            const req = createMockRequest('http://localhost/api/reviews/create', {
                method: 'POST',
                body: {
                    booking_id: bookingId,
                    rating: 4,
                    comment: 'Updated comment',
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('id', reviewId);
            expect(data).toHaveProperty('updated', true);
        });

        test('должен вернуть 400 если отзыв существует и принадлежит другому пользователю', async () => {
            const userId = 'user-id';
            const bookingId = 'booking-id';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            // Мокаем проверку бронирования
            let callCount = 0;
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'bookings') {
                    callCount++;
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: {
                                id: bookingId,
                                client_id: userId,
                                status: 'completed',
                            },
                            error: null,
                        }),
                    };
                } else if (table === 'reviews') {
                    callCount++;
                    // Отзыв существует, но принадлежит другому пользователю
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockReturnThis(),
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: {
                                id: 'review-id',
                                client_id: 'other-user-id',
                            },
                            error: null,
                        }),
                    };
                }
                return mockSupabase;
            });

            const req = createMockRequest('http://localhost/api/reviews/create', {
                method: 'POST',
                body: {
                    booking_id: bookingId,
                    rating: 5,
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400, 'REVIEW_ALREADY_EXISTS');
        });
    });
});

