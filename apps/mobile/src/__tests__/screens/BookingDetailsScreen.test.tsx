import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import BookingDetailsScreen from '../../screens/BookingDetailsScreen';
import * as SecureStore from 'expo-secure-store';

import { Linking } from 'react-native';

import { apiRequest } from '../../lib/api';
import { loadOfflineBookings } from '../../lib/offlineBookingsStorage';
import { supabase } from '../../lib/supabase';
import { createTestQueryClient } from '../testQueryClient';

let mockRouteId = 'test-booking-id';
const mockNavigationReset = jest.fn();

jest.mock('@react-navigation/native', () => ({
    NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
    useNavigation: () => ({
        navigate: jest.fn(),
        goBack: jest.fn(),
        reset: mockNavigationReset,
    }),
    useRoute: () => ({
        params: {
            id: mockRouteId,
        },
    }),
}));

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

jest.mock('../../lib/offlineBookingsStorage', () => ({
    loadOfflineBookings: jest.fn().mockResolvedValue(null),
    saveOfflineBookings: jest.fn(),
}));

function apiError(message: string, status?: number) {
    return Object.assign(new Error(message), { status });
}

describe('BookingDetailsScreen', () => {
    const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(
            <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
        );
    };

    beforeEach(() => {
        mockRouteId = 'test-booking-id';
        mockNavigationReset.mockReset();
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: {
                id: 'test-booking-id',
                start_at: '2099-01-01T10:00:00Z',
                end_at: '2099-01-01T11:00:00Z',
                status: 'confirmed',
                service: {
                    name_ru: 'Тестовая услуга',
                    duration_min: 60,
                    price_from: 1000,
                    price_to: 1500,
                },
                staff: {
                    full_name: 'Тестовый мастер',
                },
                business: {
                    name: 'Тестовый бизнес',
                    slug: 'test-business',
                    phones: ['+996555000111'],
                },
                branch: {
                    name: 'Главный филиал',
                    address: 'Some street',
                },
            },
        } as never);
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
    });

    test('renders booking details content', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByTestId('booking-details-screen')).toBeTruthy();
        expect(await screen.findByText('Тестовая услуга')).toBeTruthy();
        expect(await screen.findByText('Тестовый бизнес')).toBeTruthy();
    });

    test('shows the booking time in Asia/Bishkek when the server sends no zone', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('16:00–17:00')).toBeTruthy();
    });

    test('shows the booking time in the business time zone (ARCH-11)', async () => {
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: {
                id: 'test-booking-id',
                start_at: '2099-01-01T10:00:00Z',
                end_at: '2099-01-01T11:00:00Z',
                status: 'confirmed',
                service: { name_ru: 'Тестовая услуга', duration_min: 60, price_from: 1000, price_to: 1500 },
                staff: { full_name: 'Тестовый мастер' },
                business: { name: 'Московский бизнес', slug: 'moscow', phones: [], tz: 'Europe/Moscow' },
                branch: { name: 'Главный филиал', address: 'Some street' },
            },
        } as never);

        renderWithProviders(<BookingDetailsScreen />);

        // 10:00Z is 13:00 in Moscow (UTC+3); the Bishkek default would show 16:00.
        expect(await screen.findByText('13:00–14:00')).toBeTruthy();
        expect(screen.queryByText('16:00–17:00')).toBeNull();
    });

    test('offers to repeat a finished visit, not an upcoming one', async () => {
        renderWithProviders(<BookingDetailsScreen />);
        expect(await screen.findByText('Отменить запись')).toBeTruthy();
        expect(screen.queryByText('Повторить запись')).toBeNull();
    });

    test('renders repeat booking action for a past visit', async () => {
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: {
                id: 'test-booking-id', start_at: '2020-01-01T10:00:00Z', end_at: '2020-01-01T11:00:00Z', status: 'paid',
                viewer_role: 'client', promotion: null, package: null,
                service: null, staff: null, business: { name: 'Тестовый бизнес', slug: 'test-business', phones: [] }, branch: null,
            },
        } as never);

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Повторить запись')).toBeTruthy();
    });

    test('allows cancelling confirmed upcoming booking', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Отменить запись')).toBeTruthy();
    });

    test('returns to Cabinet after cancelling instead of an emptied booking flow', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        fireEvent.press(await screen.findByText('Отменить запись'));

        await waitFor(() => {
            expect(mockNavigationReset).toHaveBeenCalledWith({
                index: 0,
                routes: [
                    {
                        name: 'Main',
                        params: {
                            screen: 'Cabinet',
                            params: { screen: 'CabinetMain' },
                        },
                    },
                ],
            });
        });
    });

    test('shows not-found state when the server answers 404', async () => {
        mockRouteId = 'missing-booking-id';
        mockedApiRequest.mockRejectedValue(apiError('Запись не найдена', 404));

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Запись не найдена')).toBeTruthy();
        expect(screen.getByText('Запись удалена или относится к другому аккаунту.')).toBeTruthy();
        expect(screen.queryByText('Тестовая услуга')).toBeNull();
        expect(screen.queryByText('Повторить')).toBeNull();
    });

    // B4: a lost connection is not "not found".
    test('a network error offers a retry instead of not found, and the retry loads the booking', async () => {
        mockedApiRequest.mockRejectedValueOnce(apiError('Нет подключения к интернету'));

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Не удалось загрузить запись')).toBeTruthy();
        expect(screen.queryByText('Запись не найдена')).toBeNull();

        fireEvent.press(screen.getByText('Повторить'));
        expect(await screen.findByText('Тестовая услуга')).toBeTruthy();
    });

    test('a server error (500) is a retryable load error', async () => {
        mockedApiRequest.mockRejectedValue(apiError('Ошибка сервера', 500));

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Не удалось загрузить запись')).toBeTruthy();
    });

    test('offline: the cabinet copy stands in, with a banner and no actions', async () => {
        jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null } as never);
        jest.mocked(loadOfflineBookings).mockResolvedValueOnce({
            userId: 'user-1',
            updatedAt: '2026-11-20T08:00:00Z',
            items: [{
                id: 'test-booking-id', status: 'confirmed', start_at: '2099-01-01T10:00:00Z', end_at: '2099-01-01T11:00:00Z',
                service_name: 'Стрижка из кэша', staff_name: 'Мастер', branch_name: 'Филиал', business_name: 'Бизнес', created_at: 'x',
            }],
        });
        mockedApiRequest.mockRejectedValue(apiError('Нет подключения к интернету'));

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Стрижка из кэша')).toBeTruthy();
        expect(jest.mocked(loadOfflineBookings)).toHaveBeenCalledWith('user-1');
        expect(screen.getByText('Нет подключения')).toBeTruthy();
        expect(screen.queryByText('Отменить запись')).toBeNull();
        expect(screen.queryByText('Перенести запись')).toBeNull();
    });

    test('a 404 never falls back to the offline copy', async () => {
        jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null } as never);
        jest.mocked(loadOfflineBookings).mockClear();
        mockedApiRequest.mockRejectedValue(apiError('not found', 404));

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Запись не найдена')).toBeTruthy();
        expect(jest.mocked(loadOfflineBookings)).not.toHaveBeenCalled();
    });

    // B1: a master opens the booking from a push.
    test('the staff view shows the client and hides cancel, reschedule, review and repeat', async () => {
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: {
                id: 'test-booking-id', start_at: '2099-01-01T10:00:00Z', end_at: '2099-01-01T11:00:00Z', status: 'confirmed',
                viewer_role: 'staff', client_name: 'Айда', can_review: false,
                biz_id: 'biz-1', branch_id: 'branch-1', staff_id: 'staff-1', benefit_applied: false,
                service: { name_ru: 'Тестовая услуга', duration_min: 60, price_from: null, price_to: null },
                staff: { full_name: 'Тестовый мастер' },
                business: { name: 'Тестовый бизнес', slug: 'test-business', phones: ['+996555000111'] },
                branch: { name: 'Главный филиал', address: null },
            },
        } as never);

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Айда')).toBeTruthy();
        expect(screen.getByTestId('booking-staff-view-notice')).toBeTruthy();
        expect(screen.queryByText('Отменить запись')).toBeNull();
        expect(screen.queryByText('Перенести запись')).toBeNull();
        expect(screen.queryByText('Оставить отзыв')).toBeNull();
        expect(screen.queryByText('Повторить запись')).toBeNull();
    });

    // C11: complex booking, benefit, map.
    test('shows all services, the promotion with the final amount, and opens directions to the branch', async () => {
        const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: {
                id: 'test-booking-id', start_at: '2099-01-01T10:00:00Z', end_at: '2099-01-01T11:00:00Z', status: 'paid',
                viewer_role: 'client', benefit_applied: true,
                service: { name_ru: 'Стрижка', duration_min: 45, price_from: null, price_to: null },
                services: [
                    { name_ru: 'Стрижка', duration_min: 45 },
                    { name_ru: 'Укладка', duration_min: 15 },
                ],
                promotion: { title: 'Счастливые часы', discount_percent: 20, final_amount: 800 },
                package: null,
                staff: { full_name: 'Тестовый мастер' },
                business: { name: 'Тестовый бизнес', slug: 'test-business', phones: [] },
                branch: { name: 'Главный филиал', address: 'Чуй 1', lat: 42.87, lon: 74.59 },
            },
        } as never);

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Стрижка + Укладка')).toBeTruthy();
        expect(screen.getByText('Укладка · 15 мин')).toBeTruthy();
        expect(screen.getByText('Акция: Счастливые часы · Скидка 20%')).toBeTruthy();
        expect(screen.getByText('Итого: 800 сом')).toBeTruthy();
        // B6: the promo step shows for a promotion and is done once paid.
        expect(screen.getByText('Скидка применена')).toBeTruthy();

        fireEvent.press(screen.getByText('Маршрут'));
        await waitFor(() => expect(openURL).toHaveBeenCalledWith(expect.stringContaining('42.87%2C74.59')));
        openURL.mockRestore();
    });

    test('a booking without a promotion has no dead promo step', async () => {
        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Тестовая услуга')).toBeTruthy();
        expect(screen.queryByText('Скидка применена')).toBeNull();
    });

    test('paid with a package says so', async () => {
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: {
                id: 'test-booking-id', start_at: '2020-01-01T10:00:00Z', end_at: '2020-01-01T11:00:00Z', status: 'paid',
                viewer_role: 'client', benefit_applied: true, package: { name: '10 визитов', final_amount: null }, promotion: null,
                service: null, staff: null, business: { name: 'Тестовый бизнес', slug: 'test-business', phones: [] }, branch: null,
            },
        } as never);

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('По пакету визитов «10 визитов»')).toBeTruthy();
    });

    // C9: review of a past paid visit.
    test('leaves a review of a past paid visit through /api/reviews/create', async () => {
        const details = {
            id: 'test-booking-id', start_at: '2020-01-01T10:00:00Z', end_at: '2020-01-01T11:00:00Z', status: 'paid',
            viewer_role: 'client', can_review: true, review: null,
            service: { name_ru: 'Тестовая услуга', duration_min: 60, price_from: null, price_to: null },
            staff: null, business: { name: 'Тестовый бизнес', slug: 'test-business', phones: [] }, branch: null,
        };
        mockedApiRequest.mockImplementation(async (endpoint: string) =>
            (endpoint === '/reviews/create' ? { ok: true, data: { id: 'review-1', updated: false } } : { ok: true, data: details }) as never);

        renderWithProviders(<BookingDetailsScreen />);

        fireEvent.press(await screen.findByText('Оставить отзыв'));
        expect(await screen.findByTestId('review-sheet')).toBeTruthy();
        fireEvent.press(screen.getByTestId('review-star-4'));
        fireEvent.changeText(screen.getByTestId('review-comment'), '  Отлично  ');
        fireEvent.press(screen.getByText('Отправить отзыв'));

        await waitFor(() =>
            expect(mockedApiRequest).toHaveBeenCalledWith('/reviews/create', {
                method: 'POST',
                body: JSON.stringify({ booking_id: 'test-booking-id', rating: 4, comment: 'Отлично' }),
            }),
        );
        await waitFor(() => expect(screen.queryByTestId('review-sheet')).toBeNull());
    });

    test('edits the own review through /api/reviews/update and explains a refusal', async () => {
        const details = {
            id: 'test-booking-id', start_at: '2020-01-01T10:00:00Z', end_at: '2020-01-01T11:00:00Z', status: 'paid',
            viewer_role: 'client', can_review: false, review: { id: 'review-1', rating: 3, comment: 'ok' },
            service: { name_ru: 'Тестовая услуга', duration_min: 60, price_from: null, price_to: null },
            staff: null, business: { name: 'Тестовый бизнес', slug: 'test-business', phones: [] }, branch: null,
        };
        mockedApiRequest.mockImplementation(async (endpoint: string) => {
            if (endpoint === '/reviews/update') throw apiError('forbidden', 403);
            return { ok: true, data: details } as never;
        });

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Ваш отзыв: 3 из 5')).toBeTruthy();
        fireEvent.press(screen.getByText('Редактировать отзыв'));
        fireEvent.press(await screen.findByText('Сохранить отзыв'));

        await waitFor(() =>
            expect(mockedApiRequest).toHaveBeenCalledWith('/reviews/update', {
                method: 'POST',
                body: JSON.stringify({ review_id: 'review-1', rating: 3, comment: 'ok' }),
            }),
        );
        expect(await screen.findByText('Отзыв можно оставить только после визита')).toBeTruthy();
    });
    // R25-10: the client's own actions end at the start of the visit.
    test('a started booking offers no cancel or reschedule and says why', async () => {
        const startedAt = new Date(Date.now() - 10 * 60_000).toISOString();
        const endsAt = new Date(Date.now() + 50 * 60_000).toISOString();
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: {
                id: 'test-booking-id', start_at: startedAt, end_at: endsAt, status: 'confirmed',
                biz_id: 'biz-1', branch_id: 'branch-1', staff_id: 'staff-1', benefit_applied: false,
                service: { name_ru: 'Тестовая услуга', duration_min: 60, price_from: null, price_to: null },
                staff: { full_name: 'Тестовый мастер' },
                business: { name: 'Тестовый бизнес', slug: 'test-business', phones: [] },
                branch: { name: 'Главный филиал', address: null },
            },
        } as never);

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByTestId('booking-started-notice')).toBeTruthy();
        expect(screen.queryByText('Отменить запись')).toBeNull();
        expect(screen.queryByText('Перенести запись')).toBeNull();
    });

    test('a booking with a benefit is not rescheduled by the client', async () => {
        mockedApiRequest.mockResolvedValue({
            ok: true,
            data: {
                id: 'test-booking-id', start_at: '2099-01-01T10:00:00Z', end_at: '2099-01-01T11:00:00Z', status: 'confirmed',
                biz_id: 'biz-1', branch_id: 'branch-1', staff_id: 'staff-1', benefit_applied: true,
                service: null, staff: null, business: { name: 'Тестовый бизнес', slug: 'test-business', phones: [] }, branch: null,
            },
        } as never);

        renderWithProviders(<BookingDetailsScreen />);

        expect(await screen.findByText('Отменить запись')).toBeTruthy();
        expect(screen.queryByText('Перенести запись')).toBeNull();
        expect(screen.getByText('Запись с акцией или абонементом переносит организация: свяжитесь с ней.')).toBeTruthy();
    });

    test('reschedules to a free start of the same master with an idempotency key', async () => {
        const store = new Map<string, string>();
        jest.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => store.get(key) ?? null);
        jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { store.set(key, value); });
        jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key) => { store.delete(key); });
        jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'user-1' } } }, error: null } as never);
        jest.mocked(supabase.rpc).mockResolvedValue({
            data: [
                { staff_id: 'staff-1', branch_id: 'branch-1', start_at: '2099-01-02T12:00:00+00:00', end_at: '2099-01-02T13:00:00+00:00' },
                { staff_id: 'staff-2', branch_id: 'branch-1', start_at: '2099-01-02T13:00:00+00:00', end_at: '2099-01-02T14:00:00+00:00' },
            ],
            error: null,
        } as never);
        const details = {
            id: 'test-booking-id', start_at: '2099-01-01T10:00:00Z', end_at: '2099-01-01T11:00:00Z', status: 'confirmed',
            biz_id: 'biz-1', branch_id: 'branch-1', staff_id: 'staff-1', benefit_applied: false,
            service: { name_ru: 'Тестовая услуга', duration_min: 60, price_from: null, price_to: null },
            staff: { full_name: 'Тестовый мастер' },
            business: { name: 'Тестовый бизнес', slug: 'test-business', phones: [] },
            branch: { name: 'Главный филиал', address: null },
        };
        mockedApiRequest.mockImplementation(async (endpoint: string) => (endpoint.endsWith('/reschedule')
            ? { ok: true, data: { booking_id: 'test-booking-id', rescheduled: true, start_at: '2099-01-02T12:00:00+00:00', end_at: '2099-01-02T13:00:00+00:00' } }
            : { ok: true, data: details }) as never);

        renderWithProviders(<BookingDetailsScreen />);

        fireEvent.press(await screen.findByText('Перенести запись'));
        expect(await screen.findByTestId('reschedule-sheet')).toBeTruthy();
        expect(jest.mocked(supabase.rpc)).toHaveBeenCalledWith('get_free_slots_complex_day_v1', expect.objectContaining({
            p_biz_id: 'biz-1', p_staff_id: 'staff-1', p_duration_min: 60,
        }));
        // 12:00Z is 18:00 in Asia/Bishkek; the other master's start is not offered.
        fireEvent.press(await screen.findByText('18:00'));
        expect(screen.queryByText('19:00')).toBeNull();
        fireEvent.press(screen.getByText('Перенести'));

        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith('/api/bookings/test-booking-id/reschedule', expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ start_at: '2099-01-02T12:00:00+00:00' }),
                headers: expect.objectContaining({ 'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/) }),
            }));
        });
        await waitFor(() => expect(screen.queryByTestId('reschedule-sheet')).toBeNull());
    });
});
