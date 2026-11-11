import cronJobs from '@/config/cronJobs.json';
/**
 * Тесты для /api/admin/health-check
 * Комплексная проверка здоровья системы
 */

import { GET } from '@/app/api/admin/health-check/route';
import { setupApiTestMocks, createMockRequest, createMockSupabase, expectSuccessResponse, expectErrorResponse } from '../testHelpers';

setupApiTestMocks();

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

// Мокаем зависимости
jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/admin/health-check', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();

        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Авторизация', () => {
        test('должен вернуть 401 если пользователь не авторизован', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: null,
                },
                error: null,
            });

            const req = createMockRequest('http://localhost/api/admin/health-check', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 401, 'UNAUTHORIZED');
        });

        test('должен вернуть 403 если пользователь не суперадмин', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            // Мокаем проверку роли (не суперадмин)
            mockSupabase.rpc.mockResolvedValueOnce({
                    data: false,
                    error: null,
                });

            const req = createMockRequest('http://localhost/api/admin/health-check', {
                method: 'GET',
            });

            const res = await GET(req);
            await expectErrorResponse(res, 403, 'FORBIDDEN');
        });
    });

    describe('Успешная проверка здоровья', () => {
        test('должен успешно вернуть результаты проверки здоровья', async () => {
            const today = new Date().toISOString();
            mockAdmin.rpc.mockImplementation((name: string) => ({ abortSignal: async () => ({ data: name === 'read_cron_execution_health' ? cronJobs.map(job => ({ job: job.id, last_started_at: today, last_completed_at: today, last_success_at: today, last_failure_at: null, oldest_running_at: null, running_count: 0 })) : { pending:0,due:0,processing:0,failed:0,ambiguous:0,oldest_due_age_seconds:0 }, error:null }) }));

            mockSupabase.auth.getUser.mockResolvedValue({
                data: {
                    user: {
                        id: 'user-id',
                    },
                },
                error: null,
            });

            // Мокаем проверку роли (суперадмин)
            mockSupabase.rpc.mockResolvedValueOnce({
                    data: true,
                    error: null,
                });

            // Мокаем проверку открытых смен
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lt: jest.fn().mockResolvedValue({
                    count: 0, data: [],
                    error: null,
                }),
            });

            // Мокаем проверку метрик рейтингов
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        metric_date: today,
                    },
                    error: null,
                }),
            });

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        metric_date: today,
                    },
                    error: null,
                }),
            });

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        metric_date: today,
                    },
                    error: null,
                }),
            });

            // Мокаем проверку промоакций
            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        created_at: today,
                    },
                    error: null,
                }),
            });

            mockAdmin.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({ count: 5,
                    error: null,
                }),
            });

            const req = createMockRequest('http://localhost/api/admin/health-check', {
                method: 'GET',
            });

            const res = await GET(req);
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('alerts');
            expect(data).toHaveProperty('checks');
            expect((data as { checks: unknown }).checks).toHaveProperty('shifts');
            expect((data as { checks: unknown }).checks).toHaveProperty('ratings');
            expect((data as { checks: unknown }).checks).toHaveProperty('promotions');
        });
    });
});


