/**
 * Тесты для /api/staff/shift/today
 * Получение информации о текущей смене сотрудника
 */

import { GET } from '@/app/api/staff/shift/today/route';

// Мокируем зависимости
jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
}));

jest.mock('@/lib/time', () => ({
    formatInTimeZone: jest.fn((date: Date, tz: string, format: string) => {
        return '2024-01-15';
    }),
    TZ: 'Asia/Bishkek',
}));

import { getStaffContext } from '@/lib/authBiz';

describe('/api/staff/shift/today', () => {
    const mockSupabase = {
        from: jest.fn(() => mockSupabase),
        select: jest.fn(() => mockSupabase),
        eq: jest.fn(() => mockSupabase),
        lte: jest.fn(() => mockSupabase),
        gte: jest.fn(() => mockSupabase),
        neq: jest.fn(() => mockSupabase),
        order: jest.fn(() => mockSupabase),
        maybeSingle: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getStaffContext as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            staffId: 'test-staff-id',
            bizId: 'test-biz-id',
            branchId: 'test-branch-id',
        });
    });

    describe('Успешное получение данных', () => {
        test('должен вернуть данные смены, если она открыта', async () => {
            // Настройка моков: настройки сотрудника
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 100,
                    },
                    error: null,
                }),
            });

            // Настройка моков: нет выходных
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: есть расписание на дату
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        intervals: [{ start: '09:00', end: '18:00' }],
                        is_active: true,
                    },
                    error: null,
                }),
            });

            // Настройка моков: есть открытая смена
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'shift-id',
                        shift_date: '2024-01-15',
                        status: 'open',
                        opened_at: '2024-01-15T09:00:00Z',
                        total_amount: 0,
                        master_share: 0,
                        salon_share: 0,
                    },
                    error: null,
                }),
            });

            // Настройка моков: элементы смены
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                data: [
                    {
                        id: 'item-1',
                        client_name: 'Test Client',
                        service_name: 'Test Service',
                        service_amount: 1000,
                        consumables_amount: 0,
                    },
                ],
                error: null,
            });

            // Настройка моков: бронирования на сегодня
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: услуги сотрудника
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                data: [
                    {
                        services: {
                            name_ru: 'Услуга 1',
                            name_ky: null,
                            name_en: null,
                        },
                    },
                ],
                error: null,
            });

            // Настройка моков: все смены для статистики
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                data: [
                    {
                        id: 'shift-1',
                        shift_date: '2024-01-14',
                        status: 'closed',
                        total_amount: 5000,
                        master_share: 3000,
                        salon_share: 2000,
                        late_minutes: 0,
                        guaranteed_amount: null,
                        topup_amount: null,
                    },
                ],
                error: null,
            });

            // Вызов API
            const response = await GET();
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(data.today.exists).toBe(true);
            expect(data.today.status).toBe('open');
            expect(data.today.shift).toBeDefined();
            expect(data.staffPercentMaster).toBe(60);
            expect(data.staffPercentSalon).toBe(40);
            expect(data.hourlyRate).toBe(100);
            expect(data.stats).toBeDefined();
            expect(data.stats.totalAmount).toBe(5000);
        });

        test('должен вернуть данные без смены, если она не открыта', async () => {
            // Настройка моков: настройки сотрудника
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: null,
                    },
                    error: null,
                }),
            });

            // Настройка моков: нет выходных
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: есть расписание
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        intervals: [{ start: '09:00', end: '18:00' }],
                        is_active: true,
                    },
                    error: null,
                }),
            });

            // Настройка моков: нет смены
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Настройка моков: бронирования
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: услуги
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: все смены
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Вызов API
            const response = await GET();
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(data.today.exists).toBe(false);
            expect(data.today.status).toBe('none');
            expect(data.today.shift).toBeNull();
            expect(data.today.items).toEqual([]);
        });

        test('должен определить выходной день', async () => {
            // Настройка моков: настройки сотрудника
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: null,
                    },
                    error: null,
                }),
            });

            // Настройка моков: есть выходной
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                data: [{ id: 'time-off-id' }],
                error: null,
            });

            // Настройка моков: нет смены
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Настройка моков: бронирования
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: услуги
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: все смены
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Вызов API
            const response = await GET();
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(data.isDayOff).toBe(true);
        });
    });

    describe('Обработка ошибок', () => {
        test('должен обработать ошибку при загрузке смены', async () => {
            // Настройка моков: настройки сотрудника
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: null,
                    },
                    error: null,
                }),
            });

            // Настройка моков: нет выходных
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: есть расписание
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        intervals: [{ start: '09:00', end: '18:00' }],
                        is_active: true,
                    },
                    error: null,
                }),
            });

            // Настройка моков: ошибка при загрузке смены
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: {
                        message: 'Database error',
                        code: 'PGRST301',
                    },
                }),
            });

            // Вызов API
            const response = await GET();
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(500);
            expect(data.ok).toBe(false);
            expect(data.error).toBeDefined();
        });

        test('должен обработать ошибку при загрузке статистики', async () => {
            // Настройка моков: настройки сотрудника
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: null,
                    },
                    error: null,
                }),
            });

            // Настройка моков: нет выходных
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: есть расписание
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        intervals: [{ start: '09:00', end: '18:00' }],
                        is_active: true,
                    },
                    error: null,
                }),
            });

            // Настройка моков: нет смены
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Настройка моков: бронирования
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: услуги
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: ошибка при загрузке статистики
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                data: null,
                error: {
                    message: 'Database error',
                    code: 'PGRST301',
                },
            });

            // Вызов API
            const response = await GET();
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(500);
            expect(data.ok).toBe(false);
            expect(data.error).toBeDefined();
        });

        test('должен обработать неожиданную ошибку', async () => {
            // Настройка моков: getStaffContext выбрасывает ошибку
            (getStaffContext as jest.Mock).mockRejectedValue(new Error('Auth error'));

            // Вызов API
            const response = await GET();
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(500);
            expect(data.ok).toBe(false);
            expect(data.error).toBeDefined();
        });
    });

    describe('Расчет гарантированной оплаты', () => {
        test('должен вернуть поля для расчета гарантированной оплаты при открытой смене с hourly_rate', async () => {
            const openedAt = new Date('2024-01-15T09:00:00Z');

            // Настройка моков: настройки сотрудника с hourly_rate
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        percent_master: 60,
                        percent_salon: 40,
                        hourly_rate: 100,
                    },
                    error: null,
                }),
            });

            // Настройка моков: нет выходных
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: есть расписание
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        intervals: [{ start: '09:00', end: '18:00' }],
                        is_active: true,
                    },
                    error: null,
                }),
            });

            // Настройка моков: открытая смена
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'shift-id',
                        shift_date: '2024-01-15',
                        status: 'open',
                        opened_at: openedAt.toISOString(),
                        total_amount: 0,
                        master_share: 0,
                        salon_share: 0,
                    },
                    error: null,
                }),
            });

            // Настройка моков: элементы смены
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: бронирования
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                neq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: услуги
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: все смены
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Вызов API
            const response = await GET();
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            // Проверяем, что поля для расчета гарантированной оплаты присутствуют
            // Значения могут быть null если смена закрыта или нет hourly_rate
            // В данном случае смена открыта и есть hourly_rate, поэтому должны быть значения
            expect(data).toHaveProperty('currentHoursWorked');
            expect(data).toHaveProperty('currentGuaranteedAmount');
            expect(data).toHaveProperty('hourlyRate', 100);
            // Если смена открыта и есть hourly_rate, значения должны быть рассчитаны
            // (но не проверяем точные значения, так как они зависят от реального времени)
        });
    });
});

