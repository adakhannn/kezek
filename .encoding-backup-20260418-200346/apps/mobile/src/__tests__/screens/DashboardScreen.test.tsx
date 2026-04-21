import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import DashboardScreen from '../../screens/DashboardScreen';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id' },
    }),
}));

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn((table: string) => {
            if (table === 'businesses') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({
                        data: [],
                        error: null,
                    }),
                };
            }

            return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    count: 0,
                }),
            };
        }),
    },
}));

describe('DashboardScreen', () => {
    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
    };

    test('renders owner empty state after loading', async () => {
        renderWithProviders(<DashboardScreen />);

        expect(await screen.findByText('?? ?? ????????? ?????????? ???????')).toBeTruthy();
    });

    test('shows initial loading or owner empty state safely', async () => {
        renderWithProviders(<DashboardScreen />);

        const state =
            screen.queryByText(/????????|loading/i) ||
            (await screen.findByText('Вы не являетесь владельцем бизнеса'));

        expect(state).toBeTruthy();
    });
});
