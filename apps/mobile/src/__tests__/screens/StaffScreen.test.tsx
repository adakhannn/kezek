import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

import { LanguageProvider } from '../../i18n';
import { setRequestLocale } from '../../i18n/locale';
import { LOCALE_STORAGE_KEY } from '../../i18n/localeStorage';
import StaffScreen from '../../screens/StaffScreen';
import { STAFF_BOOKINGS_PAGE_SIZE } from '../../screens/staff/useStaffBookings';
import { supabase } from '../../lib/supabase';
import { staffCard, staffCardsQuery } from '../staffCards';
import { createTestQueryClient } from '../testQueryClient';

const mockNavigate = jest.fn();

const TEXT = {
    nonStaffTitle: 'Вы не являетесь сотрудником',
    nonStaffMessage: 'Здесь будут отображаться ваши записи после назначения сотрудником',
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

    type BookingsBuilder = Record<'select' | 'eq' | 'neq' | 'gte' | 'lt' | 'order' | 'range', jest.Mock>;
    const mockBookingsQuery = (data: unknown[], error: Error | null = null): BookingsBuilder => {
        const builder = {} as BookingsBuilder;
        for (const method of ['select', 'eq', 'neq', 'gte', 'lt', 'order'] as const) builder[method] = jest.fn(() => builder);
        builder.range = jest.fn(async () => ({ data, error }));
        return builder;
    };

    // Upcoming bookings of the card named by the staff_id filter.
    const mockBookingsByStaff = (byStaff: Record<string, unknown[]>) => {
        let staffId = '';
        const builder: BookingsBuilder = {
            select: jest.fn(() => builder),
            eq: jest.fn((column: string, value: string) => {
                if (column === 'staff_id') staffId = value;
                return builder;
            }),
            neq: jest.fn(() => builder),
            gte: jest.fn(() => builder),
            lt: jest.fn(() => builder),
            order: jest.fn(() => builder),
            range: jest.fn(async () => ({ data: byStaff[staffId] ?? [], error: null })),
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
        setRequestLocale('ru');
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
        expect(await screen.findByTestId('staff-avatar-editor')).toBeTruthy();
        expect(await screen.findByText('Adakhan')).toBeTruthy();
        expect(await screen.findByText(TEXT.branchName)).toBeTruthy();
        expect(await screen.findByText('Low Fade')).toBeTruthy();
        expect(await screen.findByText(TEXT.upcomingTitle)).toBeTruthy();
        expect(await screen.findByText(TEXT.serviceName)).toBeTruthy();
        expect(await screen.findByText('Клиент: Client One')).toBeTruthy();
        expect(await screen.findByText('+996 555 111 222')).toBeTruthy();
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
            expect(screen.getByTestId('staff-avatar-editor')).toBeTruthy();
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
            expect(screen.queryByTestId('staff-avatar-editor')).toBeNull();
        });

        // Low Fade (staff-a) is the remembered business and has a shift change not sent yet.
        const lowFadeWithUnsentChange = () => {
            twoBusinesses();
            secureStorage.set(SELECTION_KEY, 'staff-a');
            secureStorage.set('shift_offline_queue', JSON.stringify([{
                type: 'addItem',
                owner: { userId: 'test-user-id', staffId: 'staff-a' },
                state: 'pending',
                timestamp: '2026-06-03T09:00:00.000Z',
                data: { expectedShiftId: 'shift-a', expectedRevision: 2, items: [] },
            }]));
        };

        test('does not switch away from a business with unsent shift changes', async () => {
            lowFadeWithUnsentChange();

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

        test('in English, the refusal names its reason instead of the generic error', async () => {
            lowFadeWithUnsentChange();
            secureStorage.set(LOCALE_STORAGE_KEY, 'en');

            renderWithProviders(
                <LanguageProvider>
                    <StaffScreen />
                </LanguageProvider>,
            );

            fireEvent.press(await screen.findByText('Change business'));
            fireEvent.press(await screen.findByText('Barber One'));

            expect(
                await screen.findByText(
                    'The business “Low Fade” has unsent shift changes. Open it first and wait until they are sent.',
                ),
            ).toBeTruthy();
            expect(screen.queryByText('Could not select the business. Please try again.')).toBeNull();
            expect(secureStorage.get(SELECTION_KEY)).toBe('staff-a');
        });
    });

    describe('bookings list (S1)', () => {
        const oneCard = (bookings: (tab: 'upcoming' | 'past', offset: number) => unknown[]) => {
            const builders: BookingsBuilder[] = [];
            mockedSupabase.from.mockImplementation((table: string) => {
                if (table === 'staff') return staffCardsQuery([staffCard({ id: 'staff-1', business: { id: 'biz-1', name: 'Low Fade', tz: 'Asia/Bishkek' } })]);
                let tab: 'upcoming' | 'past' = 'upcoming';
                const builder = mockBookingsQuery([]);
                builder.lt.mockImplementation(() => { tab = 'past'; return builder; });
                builder.range.mockImplementation(async (from: number) => ({ data: bookings(tab, from), error: null }));
                builders.push(builder);
                return builder;
            });
            return builders;
        };

        test('upcoming: not cancelled and not yet ended, soonest first; past: ended, latest first', async () => {
            const builders = oneCard((tab) => tab === 'upcoming'
                ? [booking('up-1', 'Будущая стрижка')]
                : [{ ...booking('past-1', 'Прошлая стрижка'), status: 'no_show' }]);

            renderWithProviders(<StaffScreen />);

            expect(await screen.findByText('Будущая стрижка')).toBeTruthy();
            expect(builders[0].neq).toHaveBeenCalledWith('status', 'cancelled');
            expect(builders[0].gte).toHaveBeenCalledWith('end_at', expect.any(String));
            expect(builders[0].order).toHaveBeenCalledWith('start_at', { ascending: true });
            expect(builders[0].range).toHaveBeenCalledWith(0, STAFF_BOOKINGS_PAGE_SIZE);

            fireEvent.press(screen.getByText('Прошедшие'));
            expect(await screen.findByText('Прошлая стрижка')).toBeTruthy();
            expect(screen.getByText('Не пришёл')).toBeTruthy();
            const past = builders[builders.length - 1];
            expect(past.lt).toHaveBeenCalledWith('end_at', expect.any(String));
            expect(past.neq).not.toHaveBeenCalled();
            expect(past.order).toHaveBeenCalledWith('start_at', { ascending: false });
        });

        test('pages through the list with Показать ещё', async () => {
            oneCard((_tab, offset) => offset === 0
                ? Array.from({ length: STAFF_BOOKINGS_PAGE_SIZE + 1 }, (_, index) => booking('b-' + index, 'Услуга ' + index))
                : [booking('b-last', 'Последняя услуга')]);

            renderWithProviders(<StaffScreen />);

            expect(await screen.findByText('Услуга 0')).toBeTruthy();
            expect(screen.queryByText('Услуга ' + STAFF_BOOKINGS_PAGE_SIZE)).toBeNull();
            fireEvent.press(screen.getByText('Показать ещё'));
            expect(await screen.findByText('Последняя услуга')).toBeTruthy();
            expect(screen.queryByText('Показать ещё')).toBeNull();
        });

        test('a booking opens its details; the phone is callable and opens WhatsApp', async () => {
            const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
            oneCard(() => [{ ...booking('b-1', 'Стрижка'), client_name: 'Айбек', client_phone: '+996 555 111 222' }]);

            renderWithProviders(<StaffScreen />);

            fireEvent.press(await screen.findByTestId('staff-booking-b-1'));
            expect(mockNavigate).toHaveBeenCalledWith('BookingDetails', { id: 'b-1' });

            fireEvent.press(screen.getByText('Позвонить'));
            await waitFor(() => expect(openUrl).toHaveBeenCalledWith('tel:+996555111222'));
            fireEvent.press(screen.getByText('WhatsApp'));
            await waitFor(() => expect(openUrl).toHaveBeenCalledWith('https://wa.me/996555111222'));
        });

        test('a failed bookings read is shown in the list, with retry, and the workspace stays', async () => {
            mockedSupabase.from.mockImplementation((table: string) => table === 'staff'
                ? staffCardsQuery([staffCard({ id: 'staff-1' })])
                : mockBookingsQuery([], new Error('bookings down')));

            renderWithProviders(<StaffScreen />);

            expect(await screen.findByText('Не удалось загрузить записи')).toBeTruthy();
            expect(screen.getByText(TEXT.shiftAction)).toBeTruthy();
            expect(screen.queryByText('Нет предстоящих записей')).toBeNull();
        });

        test('Моё расписание opens the schedule', async () => {
            oneCard(() => []);
            renderWithProviders(<StaffScreen />);
            fireEvent.press(await screen.findByText('Моё расписание'));
            expect(mockNavigate).toHaveBeenCalledWith('StaffSchedule');
        });
    });
});
