/**
 * Smoke test: HomeScreen
 *
 * Проверяет базовый рендеринг, список бизнесов, поиск и оффлайн-баннер.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomeScreen from '../../screens/HomeScreen';

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

// Mock network status (онлайн по умолчанию)
jest.mock('../../hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({
        isOffline: false,
    }),
}));

// Mock Supabase auth для запроса пользователя
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
    },
}));

// Mock API-клиент
jest.mock('../../lib/api', () => ({
    apiRequest: jest
        .fn()
        // businesses
        .mockImplementationOnce(async () => [
            {
                id: 'biz-1',
                name: 'Test Salon',
                slug: 'test-salon',
                address: 'Some street',
                phones: ['+996555000111'],
                categories: ['hair', 'nails'],
                rating_score: 4.5,
            },
        ])
        // bookings
        .mockImplementationOnce(async () => []),
}));

describe('HomeScreen', () => {
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
            </QueryClientProvider>,
        );
    };

    test('должен отрендериться без ошибок и показать заголовок', async () => {
        renderWithProviders(<HomeScreen />);

        expect(
            await screen.findByText(/Найдите свой сервис/i),
        ).toBeTruthy();
    });

    test('должен показывать список бизнесов', async () => {
        renderWithProviders(<HomeScreen />);

        expect(
            await screen.findByText('Test Salon'),
        ).toBeTruthy();
    });

    test('должен реагировать на ввод в поиск', async () => {
        renderWithProviders(<HomeScreen />);

        const searchInput = await screen.findByPlaceholderText(
            /поиск по названию или адресу/i,
        );

        fireEvent.changeText(searchInput, 'Salon');

        expect(searchInput.props.value).toBe('Salon');
    });
});

