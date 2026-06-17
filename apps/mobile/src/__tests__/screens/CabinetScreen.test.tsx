import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import CabinetScreen from '../../screens/CabinetScreen';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { shouldStackCabinetHeader } from '../../screens/cabinet/CabinetScreenSections';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

jest.mock('../../lib/offlineBookingsStorage', () => ({
    loadOfflineBookings: jest.fn(async () => null),
    saveOfflineBookings: jest.fn(async () => undefined),
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

    test('stacks the hero through the 412dp mobile profile', () => {
        expect(shouldStackCabinetHeader(360)).toBe(true);
        expect(shouldStackCabinetHeader(412)).toBe(true);
        expect(shouldStackCabinetHeader(421)).toBe(false);
    });

    test('exposes localized semantic labels for booking tabs', async () => {
        renderWithProviders(<CabinetScreen />);

        expect(await screen.findByRole('tab', { name: 'Предстоящие записи' })).toBeTruthy();
        expect(await screen.findByRole('tab', { name: 'История записей' })).toBeTruthy();
    });

    test('offers sign-out recovery when the session user is unavailable', async () => {
        mockedSupabase.auth.getUser.mockResolvedValueOnce({
            data: { user: null },
            error: new Error('network unavailable'),
        });

        renderWithProviders(<CabinetScreen />);

        expect(await screen.findByText('Пользователь не найден')).toBeTruthy();
        expect(await screen.findByText('Выйти и войти снова')).toBeTruthy();
    });

    test('renders empty upcoming bookings state', async () => {
        renderWithProviders(<CabinetScreen />);

        expect(await screen.findByText('Пока нет предстоящих записей')).toBeTruthy();
        expect(await screen.findByText('Запишитесь на услугу, и ближайший визит сразу появится в кабинете.')).toBeTruthy();
    });

    test('renders bookings from API envelope', async () => {
        mockedApiRequest.mockResolvedValueOnce({
            ok: true,
            data: [
                {
                    id: 'booking-1',
                    start_at: '2026-12-02T14:00:00Z',
                    end_at: '2026-12-02T14:30:00Z',
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

    test('renders bookings error state when network and cache are unavailable', async () => {
        mockedApiRequest.mockRejectedValueOnce(new Error('network unavailable'));

        renderWithProviders(<CabinetScreen />);

        expect(await screen.findAllByText('Не удалось загрузить записи')).toHaveLength(2);
        expect(await screen.findByText('Повторить')).toBeTruthy();
    });
});

