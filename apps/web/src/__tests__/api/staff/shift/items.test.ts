/**
 * Интеграционные тесты для /api/staff/shift/items
 * Критичная операция: сохранение списка клиентов для открытой смены
 */

import { POST } from '@/app/api/staff/shift/items/route';

// Мокируем зависимости
jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, config, handler) => handler()),
    RateLimitConfigs: {},
}));

import { getStaffContext, getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

describe('/api/staff/shift/items', () => {
    const mockSupabase = {
        from: jest.fn(() => mockSupabase),
        select: jest.fn(() => mockSupabase),
        insert: jest.fn(() => mockSupabase),
        update: jest.fn(() => mockSupabase),
        delete: jest.fn(() => mockSupabase),
        eq: jest.fn(() => mockSupabase),
        in: jest.fn(() => mockSupabase),
        maybeSingle: jest.fn(),
        single: jest.fn(),
    };

    const mockAdmin = {
        from: jest.fn(() => mockAdmin),
        select: jest.fn(() => mockAdmin),
        update: jest.fn(() => mockAdmin),
        eq: jest.fn(() => mockAdmin),
        maybeSingle: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getStaffContext as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            staffId: 'test-staff-id',
            bizId: 'test-biz-id',
        });
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    describe('Успешное сохранение', () => {
        test('должен сохранить список клиентов и пересчитать доли', async () => {
            // Мокируем существующую смену
            mockSupabase.maybeSingle.mockResolvedValue({
                data: {
                    id: 'shift-id',
                    status: 'open',
                    shift_date: '2024-01-26',
                    total_amount: 0,
                    consumables_amount: 0,
                    percent_master: 60,
                    percent_salon: 40,
                },
                error: null,
            });

            // Мокируем успешное сохранение items
            mockSupabase.insert.mockResolvedValue({
                data: [],
                error: null,
            });

            // Мокируем успешное обновление смены
            mockAdmin.update.mockResolvedValue({
                data: { id: 'shift-id' },
                error: null,
            });

            const req = new Request('http://localhost/api/staff/shift/items', {
                method: 'POST',
                body: JSON.stringify({
                    items: [
                        {
                            clientName: 'Иван Иванов',
                            serviceName: 'Стрижка',
                            serviceAmount: 1000,
                            consumablesAmount: 100,
                        },
                        {
                            clientName: 'Петр Петров',
                            serviceName: 'Окрашивание',
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
            expect(mockSupabase.insert).toHaveBeenCalled();
            expect(mockAdmin.update).toHaveBeenCalled();
        });

        test('должен обработать пустой список клиентов', async () => {
            mockSupabase.maybeSingle.mockResolvedValue({
                data: {
                    id: 'shift-id',
                    status: 'open',
                    shift_date: '2024-01-26',
                    total_amount: 0,
                    consumables_amount: 0,
                    percent_master: 60,
                    percent_salon: 40,
                },
                error: null,
            });

            mockAdmin.update.mockResolvedValue({
                data: { id: 'shift-id' },
                error: null,
            });

            const req = new Request('http://localhost/api/staff/shift/items', {
                method: 'POST',
                body: JSON.stringify({
                    items: [],
                }),
            });

            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
        });
    });

    describe('Валидация', () => {
        test('должен вернуть ошибку при отсутствии items', async () => {
            const req = new Request('http://localhost/api/staff/shift/items', {
                method: 'POST',
                body: JSON.stringify({}),
            });

            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.ok).toBe(false);
            expect(data.error).toContain('валидации');
        });

        test('должен вернуть ошибку при невалидных данных клиента', async () => {
            const req = new Request('http://localhost/api/staff/shift/items', {
                method: 'POST',
                body: JSON.stringify({
                    items: [
                        {
                            clientName: '', // Пустое имя
                            serviceAmount: -100, // Отрицательная сумма
                        },
                    ],
                }),
            });

            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.ok).toBe(false);
        });
    });

    describe('Обработка ошибок', () => {
        test('должен вернуть ошибку при отсутствии открытой смены', async () => {
            mockSupabase.maybeSingle.mockResolvedValue({
                data: null,
                error: null,
            });

            const req = new Request('http://localhost/api/staff/shift/items', {
                method: 'POST',
                body: JSON.stringify({
                    items: [
                        {
                            clientName: 'Иван Иванов',
                            serviceName: 'Стрижка',
                            serviceAmount: 1000,
                        },
                    ],
                }),
            });

            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.ok).toBe(false);
            expect(data.error).toContain('смена');
        });

        test('должен вернуть ошибку при ошибке сохранения в БД', async () => {
            mockSupabase.maybeSingle.mockResolvedValue({
                data: {
                    id: 'shift-id',
                    status: 'open',
                    shift_date: '2024-01-26',
                    total_amount: 0,
                    consumables_amount: 0,
                    percent_master: 60,
                    percent_salon: 40,
                },
                error: null,
            });

            mockSupabase.insert.mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
            });

            const req = new Request('http://localhost/api/staff/shift/items', {
                method: 'POST',
                body: JSON.stringify({
                    items: [
                        {
                            clientName: 'Иван Иванов',
                            serviceName: 'Стрижка',
                            serviceAmount: 1000,
                        },
                    ],
                }),
            });

            const response = await POST(req);
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.ok).toBe(false);
        });
    });
});

