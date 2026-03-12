/**
 * Тесты автосохранения списка клиентов с дебаунсом (задачи 5.2, 5.3):
 * (1) после изменений в списке через N секунд вызывается сохранение один раз;
 * (2) новое изменение сбрасывает таймер;
 * (3) «Сохранить сейчас» отменяет таймер и сохраняет;
 * (4) при удалении клиента — немедленное сохранение (стратегия из 3.1);
 * (5.3) три клиента подряд — один запрос с тремя строками; flush при смене вкладки и при размонтировании.
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';

import { FinancePage } from '../FinancePage';

const DEBOUNCE_MS = 100; // должен совпадать с значением в моке constants

const mockShift = {
    id: 'shift-1',
    shift_date: '2025-03-12',
    opened_at: '2025-03-12T09:00:00Z',
    closed_at: null,
    expected_start: null,
    late_minutes: 0,
    status: 'open' as const,
    total_amount: 0,
    consumables_amount: 0,
    master_share: 0,
    salon_share: 0,
    percent_master: 60,
    percent_salon: 40,
};

const mockFinanceData = {
    todayStatus: 'open' as const,
    todayExists: true,
    shift: mockShift,
    items: [] as Array<{
        id?: number | null;
        clientName?: string | null;
        serviceName?: string | null;
        serviceAmount?: number | null;
        consumablesAmount?: number | null;
        bookingId?: string | null;
        createdAt?: string | null;
    }>,
    bookings: [],
    services: [],
    allShifts: [],
    staffPercentMaster: 60,
    staffPercentSalon: 40,
    hourlyRate: null as number | null,
    currentHoursWorked: null as number | null,
    currentGuaranteedAmount: null as number | null,
    isDayOff: false,
};

const mockSaveItems = jest.fn().mockResolvedValue(undefined);

jest.mock('@/app/staff/finance/constants', () => ({
    SAVE_DEBOUNCE_MS: 100,
}));

jest.mock('../../hooks/useFinanceData', () => ({
    useFinanceData: () => ({
        data: mockFinanceData,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        invalidate: jest.fn(),
    }),
}));

jest.mock('../../hooks/useFinanceMutations', () => ({
    useFinanceMutations: () => ({
        saveItems: mockSaveItems,
        isSaving: false,
        isOpening: false,
        isClosing: false,
        openShift: jest.fn(),
        closeShift: jest.fn(),
    }),
}));

jest.mock('../../hooks/useServiceOptions', () => ({
    useServiceOptions: () => [],
}));

const mockCalculations = {
    totalAmount: 0,
    totalConsumables: 0,
    masterShare: 0,
    salonShare: 0,
    displayTotalAmount: 0,
};
jest.mock('../../hooks/useShiftCalculations', () => ({
    useShiftCalculations: () => mockCalculations,
}));

jest.mock('../../hooks/useShiftStats', () => ({
    useShiftStats: () => ({}),
}));

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({
        locale: 'ru' as const,
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

jest.mock('@/hooks/useToast', () => ({
    useToast: () => ({
        showError: jest.fn(),
        showSuccess: jest.fn(),
        toasts: [],
        removeToast: jest.fn(),
    }),
}));

jest.mock('@/lib/time', () => ({
    todayTz: () => new Date('2025-03-12T12:00:00Z'),
    TZ: 'Asia/Bishkek',
}));

jest.mock('../StatsView', () => ({
    StatsView: () => <div data-testid="stats-view">Stats</div>,
}));

describe('FinancePage debounced save', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockSaveItems.mockClear();
        mockFinanceData.items = [];
        if (typeof window !== 'undefined') {
            window.sessionStorage.clear();
        }
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('(1) после изменений в списке через N секунд вызывается сохранение один раз', async () => {
        render(<FinancePage staffId="staff-1" />);

        const addButton = screen.getByRole('button', { name: /добавить клиента/i });
        fireEvent.click(addButton);

        expect(mockSaveItems).not.toHaveBeenCalled();
        act(() => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(mockSaveItems).toHaveBeenCalledTimes(1);
        expect(mockSaveItems).toHaveBeenLastCalledWith(
            expect.arrayContaining([
                expect.objectContaining({
                    clientName: expect.stringMatching(/^Клиент \d+$/),
                }),
            ])
        );
    });

    test('(2) новое изменение сбрасывает таймер — после паузы сохраняется batch с двумя клиентами', () => {
        render(<FinancePage staffId="staff-1" />);

        const addButton = screen.getByRole('button', { name: /добавить клиента/i });
        fireEvent.click(addButton);
        fireEvent.click(addButton);
        act(() => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        const callsWithTwoItems = mockSaveItems.mock.calls.filter(
            (call) => Array.isArray(call[0]) && call[0].length === 2
        );
        expect(callsWithTwoItems.length).toBeGreaterThanOrEqual(1);
        expect(callsWithTwoItems[0][0]).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ clientName: expect.any(String) }),
                expect.objectContaining({ clientName: expect.any(String) }),
            ])
        );
    });

    test('(3) «Сохранить сейчас» отменяет таймер и сохраняет', async () => {
        render(<FinancePage staffId="staff-1" />);

        const addButton = screen.getByRole('button', { name: /добавить клиента/i });
        fireEvent.click(addButton);
        expect(mockSaveItems).not.toHaveBeenCalled();

        const saveNowButton = screen.getByRole('button', { name: /сохранить сейчас/i });
        fireEvent.click(saveNowButton);
        expect(mockSaveItems).toHaveBeenCalledTimes(1);

        act(() => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });
        expect(mockSaveItems).toHaveBeenCalledTimes(1);
    });

    test('(4) при удалении клиента вызывается немедленное сохранение', () => {
        const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

        render(<FinancePage staffId="staff-1" />);

        const addButton = screen.getByRole('button', { name: /добавить клиента/i });
        fireEvent.click(addButton);

        const collapseButton = screen.getByTitle(/свернуть/i);
        fireEvent.click(collapseButton);

        const deleteButton = screen.getByTitle(/удалить/i);
        fireEvent.click(deleteButton);

        expect(mockSaveItems).toHaveBeenCalled();
        const deleteCall = mockSaveItems.mock.calls.find((call) => Array.isArray(call[0]) && call[0].length === 0);
        expect(deleteCall).toBeDefined();
        expect(deleteCall![0]).toEqual([]);

        confirmSpy.mockRestore();
    });

    test('(5.3) добавление 3 клиентов подряд — через N секунд один запрос с тремя строками', () => {
        render(<FinancePage staffId="staff-1" />);

        const addButton = screen.getByRole('button', { name: /добавить клиента/i });
        fireEvent.click(addButton);
        fireEvent.click(addButton);
        fireEvent.click(addButton);

        act(() => {
            jest.advanceTimersByTime(DEBOUNCE_MS);
        });

        const callsWithThreeItems = mockSaveItems.mock.calls.filter(
            (call) => Array.isArray(call[0]) && call[0].length === 3
        );
        expect(callsWithThreeItems.length).toBeGreaterThanOrEqual(1);
        expect(callsWithThreeItems[0][0]).toHaveLength(3);
        expect(callsWithThreeItems[0][0].every((item: { clientName?: string }) => item.clientName)).toBe(true);
    });

    test('(5.3) при переключении с вкладки «Клиенты» несохранённые данные отправляются (flush)', () => {
        render(<FinancePage staffId="staff-1" />);

        const addButton = screen.getByRole('button', { name: /добавить клиента/i });
        fireEvent.click(addButton);

        const shiftTabButton = screen.getByRole('button', { name: /текущая смена/i });
        fireEvent.click(shiftTabButton);

        const flushCall = mockSaveItems.mock.calls.find((call) => Array.isArray(call[0]) && call[0].length === 1);
        expect(flushCall).toBeDefined();
        expect(flushCall![0][0]).toMatchObject({ clientName: expect.any(String) });
    });

    test('(5.3) при размонтировании несохранённые данные отправляются (best-effort flush)', () => {
        const { unmount } = render(<FinancePage staffId="staff-1" />);
        const addButton = screen.getByRole('button', { name: /добавить клиента/i });
        fireEvent.click(addButton);
        unmount();
        const flushCall = mockSaveItems.mock.calls.find((call) => Array.isArray(call[0]) && call[0].length === 1);
        expect(flushCall).toBeDefined();
    });
});
