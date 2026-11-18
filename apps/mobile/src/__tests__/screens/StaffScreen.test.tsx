import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

import StaffScreen from '../../screens/StaffScreen';
import { supabase } from '../../lib/supabase';
import { staffCard, staffCardsQuery } from '../staffCards';
import { createTestQueryClient } from '../testQueryClient';

const mockNavigate = jest.fn();

const TEXT = {
    nonStaffTitle: 'Вы не являетесь сотрудником',
    nonStaffMessage: 'Здесь будут отображаться ваши записи после назначения сотрудником',
    dashboardTitle: 'Кабинет сотрудника',
    branchName: 'Low Fade Юго-Восток',
    upcomingTitle: 'Предстоящие записи',
    serviceName: 'Взрослая стрижка',
    shiftAction: 'Моя смена',
    statsAction: 'Статистика',
    loadErrorTitle: 'Не удалось загрузить рабочую зону',
    retry: 'Повторить',
    chooseBusiness: 'Выберите бизнес',
    changeBusiness: 'Сменить бизнес',
    currentBusiness: 'Текущий',
};

const SELECTION_KEY = 'kezek_staff_selection_test-user-id';

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
}));

jest.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: { id: 'test-user-id' },
    }),
}));

describe('StaffScreen', () => {
    const mockedSupabase = supabase as unknown as {
        from: jest.Mock;
    };
    const secureStorage = new Map<string, string>();

    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
    };

    const mockBookingsQuery = (data: unknown[], error: Error | null = null) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data, error }),
    });

    // Upcoming bookings of the card named by the staff_id filter.
    const mockBookingsByStaff = (byStaff: Record<string, unknown[]>) => {
        let staffId = '';
        const builder: Record<'select' | 'eq' | 'in' | 'gte' | 'order' | 'limit', jest.Mock> = {
            select: jest.fn(() => builder),
            eq: jest.fn((column: string, value: string) => {
                if (column === 'staff_id') staffId = value;
                return builder;
            }),
            in: jest.fn(() => builder),
            gte: jest.fn(() => builder),
            order: jest.fn(() => builder),
            limit: jest.fn(async () => ({ data: byStaff[staffId] ?? [], error: null })),
        };
        return builder;
    };

    const booking = (id: string, serviceName: string) => ({
        id,
        start_at: '2026-06-03T10:00:00.000Z',
        end_at: '2026-06-03T10:30:00.000Z',
        client_name: null,
        client_phone: null,
        service: { name_ru: serviceName },
    });

    // A master with a card in two businesses; the older card is listed first.
    const twoBusinesses = () => {
        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === 'staff') {
                return staffCardsQuery([
                    staffCard({
                        id: 'staff-b',
                        biz_id: 'biz-b',
                        created_at: '2026-03-01T08:00:00.000Z',
                        branch: { id: 'branch-b', name: 'Центр' },
                        business: { id: 'biz-b', name: 'Barber One' },
                    }),
                    staffCard({
                        id: 'staff-a',
                        biz_id: 'biz-a',
                        created_at: '2026-01-01T08:00:00.000Z',
                        branch: { id: 'branch-a', name: TEXT.branchName },
                        business: { id: 'biz-a', name: 'Low Fade' },
                    }),
                ]);
            }

            return mockBookingsByStaff({
                'staff-a': [booking('booking-a', 'Стрижка в Low Fade')],
                'staff-b': [booking('booking-b', 'Стрижка в Barber One')],
            });
        });
    };

    beforeEach(() => {
        mockNavigate.mockReset();
        secureStorage.clear();
        (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => secureStorage.get(key) ?? null);
        (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string, value: string) => {
            secureStorage.set(key, value);
        });
        (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
            secureStorage.delete(key);
        });
        mockedSupabase.from.mockReset();
        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === 'staff') {
                return staffCardsQuery([]);
            }

            return mockBookingsQuery([]);
        });
    });

    afterEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockReset();
        (SecureStore.setItemAsync as jest.Mock).mockReset();
        (SecureStore.deleteItemAsync as jest.Mock).mockReset();
    });

    test('renders empty staff state after loading', async () => {
        renderWithProviders(<StaffScreen />);

        expect(await screen.findByText(TEXT.nonStaffTitle)).toBeTruthy();
        expect(await screen.findByText(TEXT.nonStaffMessage)).toBeTruthy();
    });

    test('renders staff dashboard with availability and upcoming booking', async () => {
        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === 'staff') {
                return staffCardsQuery([
                    staffCard({
                        id: 'staff-1',
                        full_name: 'Adakhan',
                        branch: { id: 'branch-1', name: TEXT.branchName },
                        business: { id: 'biz-1', name: 'Low Fade' },
                    }),
                ]);
            }

            return mockBookingsQuery([
                {
                    id: 'booking-1',
                    start_at: '2026-06-03T10:00:00.000Z',
                    end_at: '2026-06-03T10:30:00.000Z',
                    client_name: 'Client One',
                    client_phone: '+996555111222',
                    service: { name_ru: TEXT.serviceName },
                },
            ]);
        });

        renderWithProviders(<StaffScreen />);

        expect(await screen.findByTestId('staff-screen')).toBeTruthy();
        expect(await screen.findByText(TEXT.dashboardTitle)).toBeTruthy();
        expect(await screen.findByText('Adakhan')).toBeTruthy();
        expect(await screen.findByText(TEXT.branchName)).toBeTruthy();
        expect(await screen.findByText('Low Fade')).toBeTruthy();
        expect(await screen.findByText(TEXT.upcomingTitle)).toBeTruthy();
        expect(await screen.findByText(TEXT.serviceName)).toBeTruthy();
        expect(await screen.findByText('Клиент: Client One')).toBeTruthy();
        expect(await screen.findByText('+996555111222')).toBeTruthy();
        // A single business offers nothing to switch to.
        expect(screen.queryByText(TEXT.changeBusiness)).toBeNull();
    });

    test('navigates to key staff actions', async () => {
        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === 'staff') {
                return staffCardsQuery([staffCard({ id: 'staff-1', full_name: 'Adakhan' })]);
            }

            return mockBookingsQuery([]);
        });

        renderWithProviders(<StaffScreen />);

        fireEvent.press(await screen.findByText(TEXT.shiftAction));
        expect(mockNavigate).toHaveBeenCalledWith('ShiftQuick');

        fireEvent.press(await screen.findByText(TEXT.statsAction));
        expect(mockNavigate).toHaveBeenCalledWith('Shifts');
    });

    test('renders explicit load error instead of non-staff state', async () => {
        mockedSupabase.from.mockImplementation((table: string) => {
            if (table === 'staff') {
                return staffCardsQuery([], new Error('staff query failed'));
            }

            return mockBookingsQuery([]);
        });

        renderWithProviders(<StaffScreen />);

        expect(await screen.findByText(TEXT.loadErrorTitle)).toBeTruthy();
        expect(await screen.findByText(TEXT.retry)).toBeTruthy();
        expect(screen.queryByText(TEXT.nonStaffTitle)).toBeNull();
    });

    describe('master of several businesses (ARCH-02)', () => {
        test('shows a business picker, remembers the choice and shows that business', async () => {
            twoBusinesses();

            renderWithProviders(<StaffScreen />);

            expect(await screen.findByText(TEXT.chooseBusiness)).toBeTruthy();
            expect(screen.getByText('Low Fade')).toBeTruthy();
            expect(screen.getByText(TEXT.branchName)).toBeTruthy();
            expect(screen.getByText('Barber One')).toBeTruthy();
            expect(screen.getByText('Центр')).toBeTruthy();
            expect(screen.queryByText(TEXT.nonStaffTitle)).toBeNull();
            expect(screen.queryByText(TEXT.shiftAction)).toBeNull();
            expect(mockedSupabase.from).not.toHaveBeenCalledWith('bookings');

            fireEvent.press(screen.getByText('Barber One'));

            expect(await screen.findByText('Стрижка в Barber One')).toBeTruthy();
            expect(screen.getByText(TEXT.dashboardTitle)).toBeTruthy();
            expect(screen.getByText('Barber One')).toBeTruthy();
            expect(screen.queryByText('Стрижка в Low Fade')).toBeNull();
            expect(screen.getByText(TEXT.changeBusiness)).toBeTruthy();
            expect(secureStorage.get(SELECTION_KEY)).toBe('staff-b');
        });

        test('opens the remembered business and switches through Сменить бизнес', async () => {
            twoBusinesses();
            secureStorage.set(SELECTION_KEY, 'staff-b');

            renderWithProviders(<StaffScreen />);

            expect(await screen.findByText('Стрижка в Barber One')).toBeTruthy();
            expect(screen.queryByText(TEXT.chooseBusiness)).toBeNull();

            fireEvent.press(screen.getByText(TEXT.changeBusiness));

            expect(await screen.findByText(TEXT.chooseBusiness)).toBeTruthy();
            expect(screen.getByText(TEXT.currentBusiness)).toBeTruthy();
            fireEvent.press(screen.getByText('Low Fade'));

            expect(await screen.findByText('Стрижка в Low Fade')).toBeTruthy();
            expect(screen.queryByText('Стрижка в Barber One')).toBeNull();
            expect(secureStorage.get(SELECTION_KEY)).toBe('staff-a');
        });

        test('a forgotten choice of a card that is no longer active asks again', async () => {
            twoBusinesses();
            secureStorage.set(SELECTION_KEY, 'staff-deactivated');

            renderWithProviders(<StaffScreen />);

            expect(await screen.findByText(TEXT.chooseBusiness)).toBeTruthy();
            expect(screen.queryByText(TEXT.dashboardTitle)).toBeNull();
        });

        test('does not switch away from a business with unsent shift changes', async () => {
            twoBusinesses();
            secureStorage.set(SELECTION_KEY, 'staff-a');
            secureStorage.set('shift_offline_queue', JSON.stringify([{
                type: 'addItem',
                owner: { userId: 'test-user-id', staffId: 'staff-a' },
                state: 'pending',
                timestamp: '2026-06-03T09:00:00.000Z',
                data: { expectedShiftId: 'shift-a', expectedRevision: 2, items: [] },
            }]));

            renderWithProviders(<StaffScreen />);

            fireEvent.press(await screen.findByText(TEXT.changeBusiness));
            fireEvent.press(await screen.findByText('Barber One'));

            expect(
                await screen.findByText(
                    'В бизнесе «Low Fade» есть неотправленные изменения смены. Сначала откройте его и дождитесь отправки.',
                ),
            ).toBeTruthy();
            expect(secureStorage.get(SELECTION_KEY)).toBe('staff-a');
            expect(screen.queryByText('Стрижка в Barber One')).toBeNull();
        });
    });
});
