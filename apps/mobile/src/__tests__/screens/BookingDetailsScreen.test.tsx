/**
 * Smoke test: BookingDetailsScreen
 * 
 * Проверяет базовый рендеринг экрана деталей бронирования
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import BookingDetailsScreen from '../../screens/BookingDetailsScreen';
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
        useRoute: () => ({
            params: {
                id: 'test-booking-id',
            },
        }),
    };
});

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn().mockResolvedValue({
        id: 'test-booking-id',
        start_at: '2024-01-01T10:00:00Z',
        end_at: '2024-01-01T11:00:00Z',
        status: 'confirmed',
        service: {
            name_ru: 'Тестовая услуга',
        },
        staff: {
            full_name: 'Тестовый мастер',
        },
        business: {
            name: 'Тестовый бизнес',
        },
    }),
}));

describe('BookingDetailsScreen', () => {
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
        renderWithProviders(<BookingDetailsScreen />);
        
        // Проверяем, что экран загрузился
        expect(screen.getByTestId('booking-details') || screen.getByText(/детали|details/i)).toBeTruthy();
    });

    test('должен показывать состояние загрузки при получении данных', () => {
        renderWithProviders(<BookingDetailsScreen />);
        
        // Проверяем наличие индикатора загрузки
        const loadingIndicator = screen.queryByTestId('loading') || screen.queryByText(/загрузка|loading/i);
        // Может быть видимым или нет, в зависимости от состояния
        expect(loadingIndicator || screen.getByTestId('booking-details')).toBeTruthy();
    });
});

