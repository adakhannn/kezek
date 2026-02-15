/**
 * Тесты для /api/user/update-phone
 * Обновление телефона пользователя
 */

import { POST } from '@/app/api/user/update-phone/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { createSupabaseClients } from '@/lib/supabaseHelpers';

// Мокаем supabaseHelpers
jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseClients: jest.fn(),
}));

describe('/api/user/update-phone', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (createSupabaseClients as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            admin: mockAdmin,
        });
    });

    describe('Авторизация', () => {
        test('должен вернуть 401 если пользователь не авторизован', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: null,
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/user/update-phone', {
                method: 'POST',
                body: {
                    phone: '+996555123456',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 401);
        });
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при отсутствии телефона', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/user/update-phone', {
                method: 'POST',
                body: {},
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при пустом телефоне', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/user/update-phone', {
                method: 'POST',
                body: {
                    phone: '',
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при невалидном формате телефона', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/user/update-phone', {
                method: 'POST',
                body: {
                    phone: '123456', // Невалидный формат (не E.164)
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });

        test('должен вернуть 400 при телефоне без префикса +', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/user/update-phone', {
                method: 'POST',
                body: {
                    phone: '996555123456', // Без префикса +
                },
            });

            const res = await POST(req);
            await expectErrorResponse(res, 400);
        });
    });

    describe('Успешное обновление', () => {
        test('должен успешно обновить телефон пользователя', async () => {
            const userId = 'user-id';
            const newPhone = '+996555123456';

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            // Мокаем обновление телефона через admin
            mockAdmin.auth.admin.updateUserById.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                        phone: newPhone,
                    },
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/user/update-phone', {
                method: 'POST',
                body: {
                    phone: newPhone,
                },
            });

            const res = await POST(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(mockAdmin.auth.admin.updateUserById).toHaveBeenCalledWith(userId, {
                phone: newPhone,
                phone_confirm: false,
            });
        });

        test('должен успешно обновить телефон с валидным E.164 форматом', async () => {
            const userId = 'user-id';
            const validPhones = [
                '+996555123456',
                '+1234567890',
                '+442071234567',
            ];

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: userId,
                    },
                },
                error: null,
            });

            for (const phone of validPhones) {
                mockAdmin.auth.admin.updateUserById.mockResolvedValue({
                    data: {
                        user: {
                            id: userId,
                            phone,
                        },
                    },
                    error: null,
                });

                const req = createMockRequest('http://localhost/api/user/update-phone', {
                    method: 'POST',
                    body: {
                        phone,
                    },
                });

                const res = await POST(req);
                const data = await expectSuccessResponse(res, 200);

                expect(data).toHaveProperty('ok', true);
            }
        });
    });
});

