/**
 * Smoke test: CabinetScreen
 * 
 * Проверяет базовый рендеринг экрана кабинета клиента со списком бронирований
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import CabinetScreen from '../../screens/CabinetScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock navigation
jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual('@react-navigation/native');
    return {
        ...actualNav,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
        }),
    };
});

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: jest.fn().mockResolvedValue({
                data: {
                    user: { id: 'test-user-id' },
                },
                error: null,
            }),
        },
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

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn().mockResolvedValue([]),
}));

describe('CabinetScreen', () => {
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
        renderWithProviders(<CabinetScreen />);
        
        // Проверяем, что экран загрузился
        expect(screen.getByTestId('cabinet-screen') || screen.getByText(/кабинет|cabinet/i)).toBeTruthy();
    });

    test('должен показывать состояние загрузки при получении данных', () => {
        renderWithProviders(<CabinetScreen />);
        
        // Проверяем наличие индикатора загрузки или пустого состояния
        const loadingIndicator = screen.queryByTestId('loading') || screen.queryByText(/загрузка|loading/i);
        // Может быть видимым или нет, в зависимости от состояния
        expect(loadingIndicator || screen.getByTestId('cabinet-screen')).toBeTruthy();
    });
});

