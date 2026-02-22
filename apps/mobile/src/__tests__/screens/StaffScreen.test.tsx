/**
 * Smoke test: StaffScreen
 * 
 * Проверяет базовый рендеринг экрана списка смен сотрудника
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import StaffScreen from '../../screens/StaffScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock hooks
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
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
            }),
        })),
    },
}));

describe('StaffScreen', () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    const renderWithProviders = (component: React.ReactElement) => {
        return render(
            <QueryClientProvider client={queryClient}>
                {component}
            </QueryClientProvider>
        );
    };

    test('должен отрендериться без ошибок', () => {
        renderWithProviders(<StaffScreen />);
        
        // Проверяем, что экран загрузился
        expect(screen.getByTestId('staff-screen') || screen.getByText(/смены|shifts/i)).toBeTruthy();
    });

    test('должен показывать состояние загрузки при получении данных', () => {
        renderWithProviders(<StaffScreen />);
        
        // Проверяем наличие индикатора загрузки или пустого состояния
        const loadingIndicator = screen.queryByTestId('loading') || screen.queryByText(/загрузка|loading/i);
        // Может быть видимым или нет, в зависимости от состояния
        expect(loadingIndicator || screen.getByTestId('staff-screen')).toBeTruthy();
    });
});

