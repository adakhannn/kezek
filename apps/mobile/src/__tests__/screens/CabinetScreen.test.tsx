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

    test('renders cabinet screen user label', async () => {
        renderWithProviders(<CabinetScreen />);

        expect(await screen.findByText('test@example.com')).toBeTruthy();
    });

    test('renders bookings from API envelope', async () => {
        mockedApiRequest.mockResolvedValueOnce({
            ok: true,
            data: [
                {
                    id: 'booking-1',
                    start_at: '2026-06-02T14:00:00Z',
                    end_at: '2026-06-02T14:30:00Z',
                    status: 'confirmed',
                    service: {
                        name_ru: 'Adult Cut',
                    },
                    staff: {
                        full_name: 'Adakhan',
                    },
                    branch: {
                        name: 'Low Fade South',
                        address: 'Some street',
                    },
                    business: {
                        name: 'Low Fade',
                    },
                },
            ],
        } as never);

        renderWithProviders(<CabinetScreen />);

        expect(await screen.findAllByText('Adult Cut')).toHaveLength(2);
        expect(await screen.findByText('Adakhan')).toBeTruthy();
    });

});

