import React from 'react';
import { render, screen } from '@testing-library/react-native';
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

describe('ShiftQuickScreen', () => {
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
            if (endpoint === '/api/staff/finance') {
                return {
                    ok: true,
                    data: {
                        today: {
                            exists: false,
                            status: 'none',
                            shift: null,
                            items: [],
                        },
                        staffPercentMaster: 60,
                        staffPercentSalon: 40,
                        hourlyRate: null,
                        currentHoursWorked: null,
                        currentGuaranteedAmount: null,
                        isDayOff: false,
                    },
                };
            }

            return { ok: true };
        });
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
    });

    test('renders shift quick screen title', async () => {
        renderWithProviders(<ShiftQuickScreen />);

        expect(await screen.findByText('Моя смена')).toBeTruthy();
    });
});
