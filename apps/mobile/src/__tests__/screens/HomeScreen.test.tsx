import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import HomeScreen from '../../screens/HomeScreen';
import { apiRequest } from '../../lib/api';

jest.mock('@react-navigation/native', () => ({
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
    useNavigation: () => ({
        navigate: jest.fn(),
        goBack: jest.fn(),
    }),
}));

jest.mock('../../hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({
        isOffline: false,
    }),
}));

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

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

describe('HomeScreen', () => {
    const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });

        return render(
            <QueryClientProvider client={queryClient}>
                {component}
            </QueryClientProvider>,
        );
    };

    beforeEach(() => {
        mockedApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint.startsWith('/mobile/businesses')) {
                return [
                    {
                        id: 'biz-1',
                        name: 'Test Salon',
                        slug: 'test-salon',
                        address: 'Some street',
                        phones: ['+996555000111'],
                        categories: ['hair', 'nails'],
                        rating_score: 4.5,
                    },
                ];
            }

            if (endpoint === '/mobile/bookings') {
                return [];
            }

            return [];
        });
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
    });

    test('renders hero title', async () => {
        renderWithProviders(<HomeScreen />);

        expect(await screen.findByText(/Найдите свой сервис/i)).toBeTruthy();
    });

    test('renders loaded business list', async () => {
        renderWithProviders(<HomeScreen />);

        expect(await screen.findByText('Test Salon')).toBeTruthy();
    });

    test('updates search input value', async () => {
        renderWithProviders(<HomeScreen />);

        const searchInput = await screen.findByPlaceholderText(/Поиск по названию или адресу/i);
        fireEvent.changeText(searchInput, 'Salon');

        expect(searchInput.props.value).toBe('Salon');
    });
});
