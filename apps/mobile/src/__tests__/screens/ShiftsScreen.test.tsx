import React from 'react';
import { render, screen } from '@testing-library/react-native';
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

    test('renders shifts screen title', async () => {
        renderWithProviders(<ShiftsScreen />);

        expect(await screen.findByText('Смены и статистика')).toBeTruthy();
    });
});
