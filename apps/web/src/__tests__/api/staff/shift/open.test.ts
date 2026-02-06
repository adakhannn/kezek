/**
 * Тесты для /api/staff/shift/open
 * Критичная операция: открытие смены сотрудника
 */

import { POST } from '@/app/api/staff/shift/open/route';

// Мокируем зависимости
jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, config, handler) => handler()),
    RateLimitConfigs: {},
}));

jest.mock('@/lib/time', () => ({
    todayTz: jest.fn(() => new Date('2024-01-15T10:00:00Z')),
    dateAtTz: jest.fn((date: string, time: string) => new Date(`${date}T${time}:00Z`)),
    TZ: 'Asia/Bishkek',
}));

import { getStaffContext } from '@/lib/authBiz';

describe('/api/staff/shift/open', () => {
    const mockSupabase = {
        from: jest.fn(() => mockSupabase),
        select: jest.fn(() => mockSupabase),
        eq: jest.fn(() => mockSupabase),
        lte: jest.fn(() => mockSupabase),
        gte: jest.fn(() => mockSupabase),
        maybeSingle: jest.fn(),
        rpc: jest.fn(),
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

    describe('Успешное открытие смены', () => {
        test('должен успешно открыть смену при наличии рабочих часов', async () => {
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

            // Настройка моков: RPC успешно открывает смену
            mockSupabase.rpc.mockResolvedValue({
                data: {
                    ok: true,
                    action: 'created',
                    shift: {
                        id: 'new-shift-id',
                        shift_date: '2024-01-15',
                        status: 'open',
                        opened_at: '2024-01-15T10:00:00Z',
                    },
                },
                error: null,
            });

            // Вызов API
            const req = new Request('http://localhost/api/staff/shift/open', {
                method: 'POST',
            });

            const response = await POST(req);
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            expect(data.shift).toBeDefined();
            expect(data.shift.id).toBe('new-shift-id');
            expect(data.shift.status).toBe('open');
        });

        test('должен использовать еженедельное расписание, если нет правила на дату', async () => {
            // Настройка моков: нет выходных
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: нет правила на дату
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Настройка моков: есть еженедельное расписание (понедельник = 1)
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        intervals: [{ start: '10:00', end: '19:00' }],
                    },
                    error: null,
                }),
            });

            // Настройка моков: RPC успешно открывает смену
            mockSupabase.rpc.mockResolvedValue({
                data: {
                    ok: true,
                    action: 'created',
                    shift: {
                        id: 'new-shift-id',
                        shift_date: '2024-01-15',
                        status: 'open',
                    },
                },
                error: null,
            });

            // Вызов API
            const req = new Request('http://localhost/api/staff/shift/open', {
                method: 'POST',
            });

            const response = await POST(req);
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
        });
    });

    describe('Обработка ошибок', () => {
        test('должен вернуть ошибку при выходном дне (time_off)', async () => {
            // Настройка моков: есть выходной
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                data: [
                    {
                        id: 'time-off-id',
                        date_from: '2024-01-15',
                        date_to: '2024-01-15',
                    },
                ],
                error: null,
            });

            // Вызов API
            const req = new Request('http://localhost/api/staff/shift/open', {
                method: 'POST',
            });

            const response = await POST(req);
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(400);
            expect(data.ok).toBe(false);
            expect(data.error).toContain('выходной день');
        });

        test('должен вернуть ошибку при отсутствии рабочих часов', async () => {
            // Настройка моков: нет выходных
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: нет правила на дату
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Настройка моков: нет еженедельного расписания
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

            // Вызов API
            const req = new Request('http://localhost/api/staff/shift/open', {
                method: 'POST',
            });

            const response = await POST(req);
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(400);
            expect(data.ok).toBe(false);
            expect(data.error).toContain('выходной день');
        });

        test('должен вернуть ошибку при уже открытой смене (RPC)', async () => {
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

            // Настройка моков: RPC возвращает ошибку (смена уже открыта)
            mockSupabase.rpc.mockResolvedValue({
                data: {
                    ok: false,
                    error: 'Смена уже открыта на эту дату',
                },
                error: null,
            });

            // Вызов API
            const req = new Request('http://localhost/api/staff/shift/open', {
                method: 'POST',
            });

            const response = await POST(req);
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(500);
            expect(data.ok).toBe(false);
            expect(data.error).toContain('Смена уже открыта');
        });

        test('должен обработать ошибку RPC', async () => {
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

            // Настройка моков: RPC возвращает ошибку
            mockSupabase.rpc.mockResolvedValue({
                data: null,
                error: {
                    message: 'Database error',
                    code: 'PGRST301',
                },
            });

            // Вызов API
            const req = new Request('http://localhost/api/staff/shift/open', {
                method: 'POST',
            });

            const response = await POST(req);
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
            const req = new Request('http://localhost/api/staff/shift/open', {
                method: 'POST',
            });

            const response = await POST(req);
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(500);
            expect(data.ok).toBe(false);
            expect(data.error).toBeDefined();
        });
    });

    describe('Расчет опоздания', () => {
        test('должен рассчитать опоздание при открытии смены позже ожидаемого времени', async () => {
            // Настройка моков: нет выходных
            mockSupabase.from.mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                gte: jest.fn().mockReturnThis(),
                data: [],
                error: null,
            });

            // Настройка моков: расписание с началом в 09:00
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

            // Настройка моков: RPC успешно открывает смену
            mockSupabase.rpc.mockResolvedValue({
                data: {
                    ok: true,
                    action: 'created',
                    shift: {
                        id: 'new-shift-id',
                        shift_date: '2024-01-15',
                        status: 'open',
                        late_minutes: 60, // 1 час опоздания (открыли в 10:00 вместо 09:00)
                    },
                },
                error: null,
            });

            // Вызов API
            const req = new Request('http://localhost/api/staff/shift/open', {
                method: 'POST',
            });

            const response = await POST(req);
            const data = await response.json();

            // Проверки
            expect(response.status).toBe(200);
            expect(data.ok).toBe(true);
            // Проверяем, что RPC был вызван с правильными параметрами
            expect(mockSupabase.rpc).toHaveBeenCalledWith(
                'open_staff_shift_safe',
                expect.objectContaining({
                    p_late_minutes: expect.any(Number),
                })
            );
        });
    });
});

