import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import ShiftQuickScreen from '../../screens/ShiftQuickScreen';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id' },
    }),
}));

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

const TEXT = {
    title: '\u041c\u043e\u044f \u0441\u043c\u0435\u043d\u0430',
    idleStatus: '\u0421\u043c\u0435\u043d\u0430 \u043d\u0435 \u043e\u0442\u043a\u0440\u044b\u0442\u0430',
    openShift: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0441\u043c\u0435\u043d\u0443',
    activeStatus: '\u0421\u043c\u0435\u043d\u0430 \u0430\u043a\u0442\u0438\u0432\u043d\u0430',
    addClient: '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043a\u043b\u0438\u0435\u043d\u0442\u0430',
    clientName: '\u0418\u043c\u044f \u043a\u043b\u0438\u0435\u043d\u0442\u0430 *',
    service: '\u0423\u0441\u043b\u0443\u0433\u0430',
    amount: '\u0421\u0443\u043c\u043c\u0430',
    save: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
    errorTitle: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438',
    retry: '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c',
    nonStaff: '\u0412\u044b \u043d\u0435 \u044f\u0432\u043b\u044f\u0435\u0442\u0435\u0441\u044c \u0441\u043e\u0442\u0440\u0443\u0434\u043d\u0438\u043a\u043e\u043c',
};

describe('ShiftQuickScreen', () => {
    const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
    const mockedSupabase = supabase as unknown as {
        from: jest.Mock;
    };

    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
    };

    const mockStaff = (data: unknown = { id: 'staff-1', full_name: 'Test Staff' }, error: Error | null = null) => {
        mockedSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data, error }),
        });
    };

    const financeData = (overrides: Record<string, unknown> = {}) => ({
        today: {
            exists: false,
            status: 'none',
            shift: null,
            items: [],
            ...(overrides.today as Record<string, unknown> | undefined),
        },
        staffPercentMaster: 60,
        staffPercentSalon: 40,
        hourlyRate: null,
        currentHoursWorked: null,
        currentGuaranteedAmount: null,
        isDayOff: false,
        ...overrides,
    });

    beforeEach(() => {
        mockStaff();
        mockedApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint === '/api/staff/finance') {
                return {
                    ok: true,
                    data: financeData(),
                };
            }

            return { ok: true };
        });
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
        mockedSupabase.from.mockReset();
    });

    test('renders idle shift workspace and open action', async () => {
        renderWithProviders(<ShiftQuickScreen />);

        expect(await screen.findByText(TEXT.title)).toBeTruthy();
        expect(await screen.findByText(TEXT.idleStatus)).toBeTruthy();
        expect(await screen.findByText(TEXT.openShift)).toBeTruthy();
    });

    test('opens shift through staff shift API', async () => {
        renderWithProviders(<ShiftQuickScreen />);

        fireEvent.press(await screen.findByText(TEXT.openShift));

        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith('/api/staff/shift/open', { method: 'POST' });
        });
    });

    test('renders active shift add-client form and saves items', async () => {
        mockedApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint === '/api/staff/finance') {
                return {
                    ok: true,
                    data: financeData({
                        today: {
                            exists: true,
                            status: 'open',
                            shift: {
                                id: 'shift-1',
                                shift_date: '2026-06-03',
                                status: 'open',
                                opened_at: '2026-06-03T08:00:00.000Z',
                                total_amount: 0,
                                consumables_amount: 0,
                                master_share: 0,
                                salon_share: 0,
                                hours_worked: null,
                                hourly_rate: null,
                                guaranteed_amount: 0,
                            },
                            items: [],
                        },
                    }),
                };
            }

            return { ok: true };
        });

        renderWithProviders(<ShiftQuickScreen />);

        expect(await screen.findByText(TEXT.activeStatus)).toBeTruthy();
        fireEvent.press(await screen.findByText(TEXT.addClient));
        fireEvent.changeText(await screen.findByPlaceholderText(TEXT.clientName), 'Client One');
        fireEvent.changeText(await screen.findByPlaceholderText(TEXT.service), 'Haircut');
        fireEvent.changeText(await screen.findByPlaceholderText(TEXT.amount), '500');
        fireEvent.press(await screen.findByText(TEXT.save));

        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith(
                '/api/staff/shift/items',
                expect.objectContaining({ method: 'POST' }),
            );
        });
    });

    test('renders explicit load error when finance API fails without cache', async () => {
        mockedApiRequest.mockRejectedValue(new Error('UNAUTHORIZED'));

        renderWithProviders(<ShiftQuickScreen />);

        expect(await screen.findByText(TEXT.errorTitle, {}, { timeout: 5000 })).toBeTruthy();
        expect(await screen.findByText(TEXT.retry)).toBeTruthy();
    });

    test('renders non-staff state when staff lookup returns no active staff row', async () => {
        mockStaff(null);

        renderWithProviders(<ShiftQuickScreen />);

        expect(await screen.findByText(TEXT.nonStaff)).toBeTruthy();
    });
});
