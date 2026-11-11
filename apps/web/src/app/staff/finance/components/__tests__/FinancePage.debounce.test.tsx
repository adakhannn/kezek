/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, act, fireEvent, waitFor, within } from '@testing-library/react';

import { FinancePage } from '../FinancePage';
import { FinanceWriteError } from '../../services/financeDraftSession';

const DEBOUNCE_MS = 100;

const mockShift = {
    id: 'shift-1',
    ledger_revision: 7,
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

type MockItem = {
    id?: number | null;
    clientName?: string | null;
    serviceName?: string | null;
    serviceAmount?: number | null;
    consumablesAmount?: number | null;
    bookingId?: string | null;
    createdAt?: string | null;
};

const mockFinanceData = {
    todayStatus: 'open' as const,
    todayExists: true,
    shift: mockShift,
    items: [] as MockItem[],
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
const mockTransport = {
    save: mockSaveItems,
    load: jest.fn(),
    open: jest.fn(),
    close: jest.fn(),
};

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
    useFinanceMutations: () => mockTransport,
}));

jest.mock('../../hooks/useServiceOptions', () => ({
    useServiceOptions: () => [],
}));

jest.mock('../../hooks/useShiftCalculations', () => ({
    useShiftCalculations: () => ({
        totalAmount: 0,
        totalConsumables: 0,
        masterShare: 0,
        salonShare: 0,
        displayTotalAmount: 0,
    }),
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

function makeSavedItem(id: number, suffix: string): MockItem {
    return {
        id,
        clientName: `Клиент ${suffix}`,
        serviceName: `Услуга ${suffix}`,
        serviceAmount: 1000,
        consumablesAmount: 100,
        bookingId: null,
        createdAt: `2025-03-12T0${id}:00:00.000Z`,
    };
}

async function flushAsyncWork() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

async function advanceDebounce() {
    await act(async () => {
        jest.advanceTimersByTime(DEBOUNCE_MS);
        await Promise.resolve();
        await Promise.resolve();
    });
}

function renderPage() {
    return render(<FinancePage staffId="staff-1" />);
}

function clickAddClient() {
    fireEvent.click(screen.getByRole('button', { name: /добавить клиента/i }));
}

function updateExpandedClientName(index: number, value: string) {
    const inputs = screen.getAllByPlaceholderText(/введите имя клиента/i);
    fireEvent.change(inputs[index], { target: { value } });
}

function updateExpandedServiceAmount(index: number, value: string) {
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[index * 2], { target: { value } });
}

describe('FinancePage debounced save', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockSaveItems.mockReset().mockImplementation(async (items, version) => ({
            shiftId: mockShift.id, revision: version.expectedRevision + 1,
            items: items.map((item: { id?: string; clientId?: string }) => ({ ...item, id: item.id ?? item.clientId })),
        }));
        mockTransport.load.mockResolvedValue({ shift: mockShift, items: [] });
        mockFinanceData.items = [];
        if (typeof window !== 'undefined') {
            window.sessionStorage.clear();
        }
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('does not autosave a newly added empty placeholder client', async () => {
        renderPage();

        clickAddClient();
        await advanceDebounce();

        expect(mockSaveItems).not.toHaveBeenCalled();
    });

    test('autosaves one meaningful client change after debounce', async () => {
        renderPage();

        clickAddClient();
        updateExpandedClientName(0, 'Анна');
        await advanceDebounce();

        expect(mockSaveItems).toHaveBeenCalledTimes(1);
        expect(mockSaveItems).toHaveBeenLastCalledWith([
            expect.objectContaining({
                clientName: 'Анна',
            }),
        ], { expectedShiftId: mockShift.id, expectedRevision: 7, calendarDate: mockShift.shift_date });
    });

    test('batches two meaningful edits into one debounced save', async () => {
        mockFinanceData.items = [makeSavedItem(1, '1'), makeSavedItem(2, '2')];

        renderPage();
        await flushAsyncWork();

        const editButtons = screen.getAllByTitle(/редактировать/i);
        fireEvent.click(editButtons[0]);
        fireEvent.click(editButtons[1]);

        updateExpandedClientName(0, 'Анна');
        updateExpandedClientName(1, 'Бек');

        await advanceDebounce();

        expect(mockSaveItems).toHaveBeenCalledTimes(1);
        expect(mockSaveItems).toHaveBeenLastCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ clientName: 'Анна' }),
                expect.objectContaining({ clientName: 'Бек' }),
            ]), { expectedShiftId: mockShift.id, expectedRevision: 7, calendarDate: mockShift.shift_date },
        );
    });

    test('save now cancels debounce and saves meaningful changes immediately', async () => {
        mockFinanceData.items = [makeSavedItem(1, '1')];

        renderPage();
        await flushAsyncWork();

        fireEvent.click(screen.getByTitle(/редактировать/i));
        updateExpandedClientName(0, 'Сразу сохранить');

        const saveNowButton = await screen.findByRole('button', { name: /сохранить сейчас/i });
        fireEvent.click(saveNowButton);
        await flushAsyncWork();

        expect(mockSaveItems).toHaveBeenCalledTimes(1);

        await advanceDebounce();
        expect(mockSaveItems).toHaveBeenCalledTimes(1);
    });

    test('delete still saves immediately', async () => {
        mockFinanceData.items = [makeSavedItem(1, '1')];
        renderPage();
        await flushAsyncWork();

        const deleteButton = screen.getByTitle(/удалить/i);
        fireEvent.click(deleteButton);
        expect(mockSaveItems).not.toHaveBeenCalled();
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить', exact: true }));
        await flushAsyncWork();

        expect(mockSaveItems).toHaveBeenCalled();
        expect(mockSaveItems.mock.calls.find((call) => Array.isArray(call[0]) && call[0].length === 0)).toBeDefined();
    });

    test('flushes meaningful unsaved changes when leaving clients tab', async () => {
        mockFinanceData.items = [makeSavedItem(1, '1')];

        renderPage();
        await flushAsyncWork();

        fireEvent.click(screen.getByTitle(/редактировать/i));
        updateExpandedClientName(0, 'Перед уходом');

        fireEvent.click(screen.getByRole('button', { name: /текущая смена/i }));
        await waitFor(() => {
            expect(mockSaveItems).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ clientName: 'Перед уходом' })]),
                { expectedShiftId: mockShift.id, expectedRevision: 7, calendarDate: mockShift.shift_date },
            );
        });
    });

    test('flushes meaningful unsaved changes on unmount', async () => {
        mockFinanceData.items = [makeSavedItem(1, '1')];

        const { unmount } = renderPage();
        await flushAsyncWork();

        fireEvent.click(screen.getByTitle(/редактировать/i));
        updateExpandedServiceAmount(0, '2500');

        unmount();
        await waitFor(() => {
            expect(mockSaveItems).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ serviceAmount: 2500 })]),
                { expectedShiftId: mockShift.id, expectedRevision: 7, calendarDate: mockShift.shift_date },
            );
        });
    });

    test('keeps a conflicted draft visible and stops autosave until explicit discard/reload', async () => {
        mockFinanceData.items = [makeSavedItem(1, '1')];
        mockSaveItems.mockRejectedValueOnce(new FinanceWriteError('Смена изменена в другом окне', 409));
        mockTransport.load.mockResolvedValue({ shift: { ...mockShift, ledger_revision: 12 }, items: [makeSavedItem(2, 'Сервер')] });
        renderPage();
        await flushAsyncWork();
        fireEvent.click(screen.getByTitle(/редактировать/i));
        updateExpandedClientName(0, 'Мой несохранённый черновик');
        await advanceDebounce();
        expect(screen.getByRole('alert').textContent).toContain('Смена изменена');
        expect(screen.getByDisplayValue('Мой несохранённый черновик')).toBeTruthy();
        await advanceDebounce();
        updateExpandedClientName(0, 'Черновик остаётся доступен');
        await advanceDebounce();
        expect(mockSaveItems).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: /отказаться от черновика и загрузить/i }));
        await flushAsyncWork();
        expect(screen.queryByDisplayValue('Черновик остаётся доступен')).toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
    });
});
