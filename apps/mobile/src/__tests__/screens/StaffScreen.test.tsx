import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import StaffScreen from '../../screens/StaffScreen';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id' },
    }),
}));

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
            }),
            maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        })),
    },
}));

describe('StaffScreen', () => {
    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
    };

    test('renders empty staff state after loading', async () => {
        renderWithProviders(<StaffScreen />);

        expect(await screen.findByText('Вы не являетесь сотрудником')).toBeTruthy();
    });

    test('shows initial loading or empty state safely', async () => {
        renderWithProviders(<StaffScreen />);

        const state =
            screen.queryByText(/Загрузка|loading/i) ||
            (await screen.findByText('Вы не являетесь сотрудником'));

        expect(state).toBeTruthy();
    });
});
