import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import ShiftsScreen from '../../screens/ShiftsScreen';
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

describe('ShiftsScreen', () => {
    const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
    const mockedSupabase = supabase as unknown as {
        from: jest.Mock;
    };

    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
    };

    beforeEach(() => {
        mockedSupabase.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'staff-1', full_name: 'Test Staff' },
                error: null,
            }),
        });

        mockedApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint.includes('/api/dashboard/staff/staff-1/finance/stats')) {
                return {
                    ok: true,
                    stats: {
                        period: 'day',
                        dateFrom: '2026-03-30',
                        dateTo: '2026-03-30',
                        staffName: 'Test Staff',
                        shiftsCount: 1,
                        openShiftsCount: 0,
                        closedShiftsCount: 1,
                        totalAmount: 1000,
                        totalMaster: 600,
                        totalSalon: 400,
                        totalConsumables: 50,
                        totalLateMinutes: 0,
                        totalClients: 1,
                        shifts: [],
                    },
                };
            }

            return { ok: true };
        });
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
    });

    test('renders shifts screen header data', async () => {
        renderWithProviders(<ShiftsScreen />);

        expect(await screen.findByText('Test Staff')).toBeTruthy();
    });

    test('changes stats query when period filter changes', async () => {
        renderWithProviders(<ShiftsScreen />);

        fireEvent.press(await screen.findByText('Месяц'));

        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith(expect.stringContaining('period=month'));
        });

        fireEvent.press(await screen.findByText('Год'));

        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith(expect.stringContaining('period=year'));
        });
    });

    test('renders retry action when stats request fails', async () => {
        mockedApiRequest.mockRejectedValue(new Error('UNAUTHORIZED'));

        renderWithProviders(<ShiftsScreen />);

        expect(await screen.findByText('Не удалось загрузить историю смен', {}, { timeout: 5000 })).toBeTruthy();
        expect(await screen.findByText('Повторить')).toBeTruthy();
    });

    test('renders totals and expanded shift item consistently', async () => {
        mockedApiRequest.mockResolvedValue({
            ok: true,
            stats: {
                period: 'day',
                dateFrom: '2026-06-06',
                dateTo: '2026-06-06',
                staffName: 'Test Staff',
                shiftsCount: 1,
                openShiftsCount: 0,
                closedShiftsCount: 1,
                totalAmount: 800,
                totalMaster: 480,
                totalSalon: 440,
                totalConsumables: 120,
                totalLateMinutes: 0,
                totalClients: 1,
                shifts: [
                    {
                        id: 'shift-1',
                        shift_date: '2026-06-06',
                        status: 'closed',
                        opened_at: '2026-06-06T11:00:00.000Z',
                        closed_at: '2026-06-06T12:00:00.000Z',
                        total_amount: 800,
                        consumables_amount: 120,
                        master_share: 480,
                        salon_share: 440,
                        late_minutes: 0,
                        hours_worked: 1,
                        hourly_rate: null,
                        guaranteed_amount: 0,
                        items: [
                            {
                                id: 'item-1',
                                client_name: 'F3 Client',
                                service_name: 'Haircut',
                                service_amount: 800,
                                consumables_amount: 120,
                                note: null,
                                booking_id: null,
                                created_at: '2026-06-06T11:30:00.000Z',
                            },
                        ],
                    },
                ],
            },
        });

        renderWithProviders(<ShiftsScreen />);

        expect(await screen.findAllByText('800 сом')).toHaveLength(2);
        expect(await screen.findByText('480 сом')).toBeTruthy();
        expect(await screen.findByText('440 сом')).toBeTruthy();
        expect(await screen.findByText('(1 клиентов)')).toBeTruthy();

        fireEvent.press(await screen.findByText('06 июня 2026'));

        expect(await screen.findByText('F3 Client')).toBeTruthy();
        expect(await screen.findByText('Haircut')).toBeTruthy();
        expect(await screen.findAllByText('Расходники: 120 сом')).toHaveLength(2);
    });

    test('renders successful empty state when selected period has no shifts', async () => {
        renderWithProviders(<ShiftsScreen />);

        expect(await screen.findByText('Нет смен')).toBeTruthy();
        expect(await screen.findByText('За выбранный период смен не найдено')).toBeTruthy();
    });
});

