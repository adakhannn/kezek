import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import CabinetScreen from '../../screens/CabinetScreen';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

describe('CabinetScreen', () => {
    const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
    const mockedSupabase = supabase as unknown as {
        auth: {
            getUser: jest.Mock;
        };
    };

    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
    };

    beforeEach(() => {
        mockedSupabase.auth.getUser.mockResolvedValue({
            data: {
                user: {
                    id: 'test-user-id',
                    email: 'test@example.com',
                    phone: null,
                },
            },
            error: null,
        });

        mockedApiRequest.mockResolvedValue([]);
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
        mockedSupabase.auth.getUser.mockReset();
    });

    test('renders cabinet screen root', async () => {
        renderWithProviders(<CabinetScreen />);

        expect(await screen.findByTestId('cabinet-screen')).toBeTruthy();
    });

    test('renders cabinet screen title', async () => {
        renderWithProviders(<CabinetScreen />);

        expect(await screen.findByText('Личный кабинет')).toBeTruthy();
    });
});
