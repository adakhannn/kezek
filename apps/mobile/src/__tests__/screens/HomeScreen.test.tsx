import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Location from 'expo-location';

import HomeScreen from '../../screens/HomeScreen';
import { apiRequest } from '../../lib/api';
import { createTestQueryClient } from '../testQueryClient';

let mockIsOffline = false;
const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
    useNavigation: () => ({
        navigate: mockNavigate,
        goBack: jest.fn(),
    }),
}));

jest.mock('../../hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({
        isOffline: mockIsOffline,
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
    const mockedLocation = Location as jest.Mocked<typeof Location>;

    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(
            <QueryClientProvider client={queryClient}>
                {component}
            </QueryClientProvider>,
        );
    };

    beforeEach(() => {
        mockIsOffline = false;
        mockNavigate.mockClear();
        mockedLocation.hasServicesEnabledAsync.mockResolvedValue(true);
        mockedLocation.requestForegroundPermissionsAsync.mockResolvedValue({
            status: 'granted',
            granted: true,
            canAskAgain: true,
            expires: 'never',
        } as Location.LocationPermissionResponse);
        mockedLocation.getCurrentPositionAsync.mockResolvedValue({
            coords: {
                latitude: 42.8746,
                longitude: 74.5698,
                altitude: null,
                accuracy: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
            },
            timestamp: 0,
        } as Location.LocationObject);
        mockedLocation.getLastKnownPositionAsync.mockResolvedValue({
            coords: {
                latitude: 42.8746,
                longitude: 74.5698,
                altitude: null,
                accuracy: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
            },
            timestamp: 0,
        } as Location.LocationObject);
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

            if (endpoint.startsWith('/api/branches/nearby')) {
                return [];
            }

            return [];
        });
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
        jest.clearAllMocks();
    });

    test('renders hero title', async () => {
        renderWithProviders(<HomeScreen />);

        expect(await screen.findByTestId('home-hero-title')).toBeTruthy();
    });

    test('renders loaded business list', async () => {
        renderWithProviders(<HomeScreen />);

        expect(await screen.findByText('Test Salon')).toBeTruthy();
    });

    test('renders nearby discovery entry point', async () => {
        renderWithProviders(<HomeScreen />);

        expect(await screen.findByText('Ближайшие филиалы')).toBeTruthy();
        expect(
            await screen.findByText(
                'Разрешите геолокацию, и мы покажем ближайшие филиалы с учётом расстояния.',
            ),
        ).toBeTruthy();
        expect(await screen.findByText('Найти рядом')).toBeTruthy();
    });

    test('opens the mobile branch map from nearby discovery', async () => {
        renderWithProviders(<HomeScreen />);

        fireEvent.press(await screen.findByText('Открыть карту филиалов'));

        expect(mockNavigate).toHaveBeenCalledWith('Map');
    });

    test('loads nearby branches after location permission is granted', async () => {
        mockedApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint.startsWith('/mobile/businesses')) {
                return [];
            }

            if (endpoint === '/mobile/bookings') {
                return [];
            }

            if (endpoint.startsWith('/api/branches/nearby')) {
                return {
                    ok: true,
                    data: [
                        {
                            id: 'branch-near-1',
                            businessId: 'biz-near-1',
                            businessName: 'Nearby Salon',
                            businessSlug: 'nearby-salon',
                            branchName: 'Main Branch',
                            address: 'Chui 1',
                            lat: 42.87,
                            lon: 74.56,
                            categoryId: 'cat-1',
                            categoryName: 'hair',
                            distanceKm: 1.2,
                        },
                    ],
                };
            }

            return [];
        });

        renderWithProviders(<HomeScreen />);

        fireEvent.press(await screen.findByText('Найти рядом'));

        await waitFor(() => {
            expect(mockedLocation.requestForegroundPermissionsAsync).toHaveBeenCalled();
            expect(mockedApiRequest).toHaveBeenCalledWith(
                '/api/branches/nearby?lat=42.8746&lon=74.5698&limit=5&radiusKm=20',
            );
        });
        expect(await screen.findByText('Nearby Salon')).toBeTruthy();
        expect(await screen.findByText('1.2 км')).toBeTruthy();
    });

    test('falls back to last known location when current GPS lookup fails', async () => {
        mockedLocation.getCurrentPositionAsync.mockRejectedValueOnce(new Error('Location timeout'));
        mockedApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint.startsWith('/mobile/businesses') || endpoint === '/mobile/bookings') {
                return [];
            }

            if (endpoint.startsWith('/api/branches/nearby')) {
                return [
                    {
                        id: 'branch-last-known',
                        businessId: 'biz-last-known',
                        businessName: 'Last Known Salon',
                        businessSlug: 'last-known-salon',
                        branchName: 'Center',
                        address: 'Lenina 1',
                        distanceKm: 2.4,
                    },
                ];
            }

            return [];
        });

        renderWithProviders(<HomeScreen />);

        fireEvent.press(await screen.findByText('Найти рядом'));

        await waitFor(() => {
            expect(mockedLocation.getLastKnownPositionAsync).toHaveBeenCalled();
            expect(mockedApiRequest).toHaveBeenCalledWith(
                '/api/branches/nearby?lat=42.8746&lon=74.5698&limit=5&radiusKm=20',
            );
        });
        expect(await screen.findByText('Last Known Salon')).toBeTruthy();
    });

    test('shows a clear nearby permission denial state', async () => {
        mockedLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
            status: 'denied',
            granted: false,
            canAskAgain: true,
            expires: 'never',
        } as Location.LocationPermissionResponse);

        renderWithProviders(<HomeScreen />);

        fireEvent.press(await screen.findByText('Найти рядом'));

        expect(await screen.findByText(
            'Доступ к геолокации не разрешён. Можно попробовать ещё раз или выбрать бизнес из списка ниже.',
        )).toBeTruthy();
    });

    test('updates search input value', async () => {
        renderWithProviders(<HomeScreen />);

        const searchInput = await screen.findByTestId('home-search-input');
        fireEvent.changeText(searchInput, 'Salon');

        expect(searchInput.props.value).toBe('Salon');
    });

    test('debounces search requests while keeping input responsive', async () => {
        renderWithProviders(<HomeScreen />);

        const searchInput = await screen.findByTestId('home-search-input');
        fireEvent.changeText(searchInput, 'S');
        fireEvent.changeText(searchInput, 'Sa');
        fireEvent.changeText(searchInput, 'Salon');

        expect(searchInput.props.value).toBe('Salon');

        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith('/mobile/businesses?search=Salon&page=1&limit=20');
        });
        expect(mockedApiRequest).not.toHaveBeenCalledWith('/mobile/businesses?search=S');
        expect(mockedApiRequest).not.toHaveBeenCalledWith('/mobile/businesses?search=Sa');
    });

    test('applies a category filter', async () => {
        renderWithProviders(<HomeScreen />);

        fireEvent.press((await screen.findAllByText('hair'))[0]);

        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith('/mobile/businesses?category=hair&page=1&limit=20');
        });
    });

    test('clears search and category from the empty state action', async () => {
        mockedApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint === '/mobile/businesses?page=1&limit=20') {
                return [
                    {
                        id: 'biz-1',
                        name: 'Test Salon',
                        slug: 'test-salon',
                        address: 'Some street',
                        phones: ['+996555000111'],
                        categories: ['hair'],
                        rating_score: 4.5,
                    },
                ];
            }

            if (endpoint.startsWith('/mobile/businesses?')) {
                return [];
            }

            return [];
        });

        renderWithProviders(<HomeScreen />);

        fireEvent.press((await screen.findAllByText('hair'))[0]);
        const searchInput = await screen.findByTestId('home-search-input');
        fireEvent.changeText(searchInput, 'missing');

        fireEvent.press(await screen.findByText('Сбросить фильтры'));

        expect(searchInput.props.value).toBe('');
        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith('/mobile/businesses?page=1&limit=20');
        });
    });

    test('uses a virtualized list for business cards', async () => {
        const queryClient = createTestQueryClient();
        const view = render(
            <QueryClientProvider client={queryClient}>
                <HomeScreen />
            </QueryClientProvider>,
        );

        expect(await screen.findByText('Test Salon')).toBeTruthy();
        expect(view.UNSAFE_getByType(require('react-native').FlatList)).toBeTruthy();
    });

    test('loads the next business page when the virtualized list reaches its end', async () => {
        mockedApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint === '/mobile/businesses?page=1&limit=20') {
                return Array.from({ length: 20 }, (_, index) => ({
                    id: `biz-${index + 1}`,
                    name: `Salon ${index + 1}`,
                    slug: `salon-${index + 1}`,
                    address: 'Some street',
                    phones: null,
                    categories: ['hair'],
                    rating_score: 4.5,
                }));
            }

            if (endpoint === '/mobile/businesses?page=2&limit=20') {
                return [
                    {
                        id: 'biz-21',
                        name: 'Salon 21',
                        slug: 'salon-21',
                        address: 'Some street',
                        phones: null,
                        categories: ['hair'],
                        rating_score: 4.5,
                    },
                ];
            }

            return [];
        });

        const view = renderWithProviders(<HomeScreen />);
        await screen.findByText('Salon 1');

        const list = view.UNSAFE_getByType(require('react-native').FlatList);
        fireEvent(list, 'onEndReached');

        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith('/mobile/businesses?page=2&limit=20');
            expect(list.props.data).toHaveLength(21);
        });
    });

    test('refetches businesses after recovering from offline network error', async () => {
        mockIsOffline = true;
        mockedApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint.startsWith('/mobile/businesses')) {
                throw new Error('Network request failed');
            }

            return [];
        });

        const queryClient = createTestQueryClient();
        const view = render(
            <QueryClientProvider client={queryClient}>
                <HomeScreen />
            </QueryClientProvider>,
        );

        expect(await screen.findByText('Не удалось загрузить список')).toBeTruthy();

        mockedApiRequest.mockClear();
        mockedApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint.startsWith('/mobile/businesses')) {
                return [
                    {
                        id: 'biz-restored',
                        name: 'Restored Salon',
                        slug: 'restored-salon',
                        address: 'Some street',
                        phones: null,
                        categories: ['hair'],
                        rating_score: 5,
                    },
                ];
            }

            return [];
        });

        mockIsOffline = false;
        view.rerender(
            <QueryClientProvider client={queryClient}>
                <HomeScreen />
            </QueryClientProvider>,
        );

        expect(await screen.findByText('Restored Salon')).toBeTruthy();
        expect(mockedApiRequest).toHaveBeenCalledWith('/mobile/businesses?page=1&limit=20');
    });
});
