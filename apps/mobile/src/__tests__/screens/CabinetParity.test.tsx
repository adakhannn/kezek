import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import CabinetScreen from '../../screens/CabinetScreen';
import { apiRequest } from '../../lib/api';
import { signOutSafely } from '../../lib/signOut';
import { supabase } from '../../lib/supabase';
import { isNearBottom } from '../../screens/cabinet/CabinetScreenSections';
import { createTestQueryClient } from '../testQueryClient';

const mockConfirm = jest.fn();

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

jest.mock('../../lib/offlineBookingsStorage', () => ({
    loadOfflineBookings: jest.fn(async () => null),
    saveOfflineBookings: jest.fn(async () => undefined),
}));

jest.mock('../../contexts/ConfirmContext', () => ({
    useConfirm: () => ({ confirm: mockConfirm }),
}));

jest.mock('../../lib/signOut', () => ({
    countPendingShiftOperations: jest.fn(async () => 0),
    signOutConfirmationText: jest.fn(() => ({ title: 'Выйти?', message: 'Вы выйдете из аккаунта', confirmLabel: 'Выйти' })),
    signOutSafely: jest.fn(async () => undefined),
}));

type Handler = (endpoint: string, init?: RequestInit) => unknown;

function pastBooking(id: string, extra: Record<string, unknown> = {}) {
    return {
        id,
        start_at: '2020-01-01T10:00:00Z',
        end_at: '2020-01-01T11:00:00Z',
        status: 'paid',
        service: { name_ru: `Услуга ${id}` },
        staff: { full_name: 'Мастер' },
        branch: { name: 'Филиал', address: 'Адрес' },
        business: { name: 'Бизнес' },
        ...extra,
    };
}

describe('CabinetScreen parity with the web cabinet', () => {
    const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;
    const mockedSupabase = supabase as unknown as { auth: { getUser: jest.Mock } };

    const renderScreen = () =>
        render(
            <QueryClientProvider client={createTestQueryClient()}>
                <CabinetScreen />
            </QueryClientProvider>,
        );

    function route(handlers: Record<string, Handler>) {
        mockedApiRequest.mockImplementation(async (endpoint: string, init?: RequestInit) => {
            const key = Object.keys(handlers).find((prefix) => endpoint.startsWith(prefix));
            if (!key) return { ok: true, data: [] } as never;
            return (await handlers[key](endpoint, init)) as never;
        });
    }

    beforeEach(() => {
        mockConfirm.mockReset();
        mockedSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1', email: 'client@example.com', phone: null } },
            error: null,
        });
    });

    afterEach(() => {
        mockedApiRequest.mockReset();
        mockedSupabase.auth.getUser.mockReset();
    });

    // B11: the history was capped at 50.
    test('loads the next history page when asked and stops at the last one', async () => {
        route({
            '/mobile/bookings?limit=50&offset=0': () => ({
                ok: true,
                data: [pastBooking('a')],
                page: { offset: 0, limit: 50, has_more: true, next_offset: 50 },
            }),
            '/mobile/bookings?limit=50&offset=50': () => ({
                ok: true,
                data: [pastBooking('b'), pastBooking('a')],
                page: { offset: 50, limit: 50, has_more: false, next_offset: null },
            }),
            '/staff-invitations': () => ({ ok: true, data: { invitations: [] } }),
            '/me/visit-packages': () => ({ ok: true, data: { packages: [] } }),
        });

        renderScreen();

        fireEvent.press(await screen.findByRole('tab', { name: 'История записей' }));
        expect(await screen.findByText('Услуга a')).toBeTruthy();
        fireEvent.press(screen.getByText('Показать ещё'));

        expect(await screen.findByText('Услуга b')).toBeTruthy();
        // A booking that moved between pages is listed once.
        expect(screen.getAllByText('Услуга a')).toHaveLength(1);
        await waitFor(() => expect(screen.queryByTestId('cabinet-load-more')).toBeNull());
    });

    test('a failed next page keeps the list and offers a retry', async () => {
        let failNext = true;
        route({
            '/mobile/bookings?limit=50&offset=0': () => ({
                ok: true,
                data: [pastBooking('a')],
                page: { offset: 0, limit: 50, has_more: true, next_offset: 50 },
            }),
            '/mobile/bookings?limit=50&offset=50': () => {
                if (failNext) {
                    failNext = false;
                    throw Object.assign(new Error('Ошибка сервера'), { status: 500 });
                }
                return { ok: true, data: [pastBooking('b')], page: { offset: 50, limit: 50, has_more: false, next_offset: null } };
            },
        });

        renderScreen();

        fireEvent.press(await screen.findByRole('tab', { name: 'История записей' }));
        fireEvent.press(await screen.findByText('Показать ещё'));
        expect(await screen.findByText('Не удалось загрузить ещё записи')).toBeTruthy();
        expect(screen.getByText('Услуга a')).toBeTruthy();

        fireEvent.press(screen.getByText('Повторить'));
        expect(await screen.findByText('Услуга b')).toBeTruthy();
    });

    test('isNearBottom triggers within the threshold only', () => {
        const event = (offset: number) => ({
            layoutMeasurement: { height: 800, width: 400 },
            contentOffset: { x: 0, y: offset },
            contentSize: { height: 2000, width: 400 },
        }) as never;
        expect(isNearBottom(event(900))).toBe(true);
        expect(isNearBottom(event(500))).toBe(false);
    });

    // C11 + C9: card shows the benefit and the review button of a past paid visit.
    test('a past paid card shows the package and leaves a review', async () => {
        route({
            '/mobile/bookings': () => ({
                ok: true,
                data: [
                    pastBooking('p', {
                        services: [{ name_ru: 'Стрижка', duration_min: 30 }, { name_ru: 'Борода', duration_min: 15 }],
                        package: { name: '5 визитов', final_amount: 0 },
                        can_review: true,
                        review: null,
                    }),
                ],
                page: { offset: 0, limit: 50, has_more: false, next_offset: null },
            }),
            '/reviews/create': () => ({ ok: true, data: { id: 'r-1' } }),
        });

        renderScreen();

        fireEvent.press(await screen.findByRole('tab', { name: 'История записей' }));
        expect(await screen.findByText('Стрижка + Борода')).toBeTruthy();
        expect(screen.getByText('Пакет · 0 сом')).toBeTruthy();

        fireEvent.press(screen.getByText('Оставить отзыв'));
        fireEvent.press(await screen.findByText('Отправить отзыв'));

        await waitFor(() =>
            expect(mockedApiRequest).toHaveBeenCalledWith('/reviews/create', {
                method: 'POST',
                body: JSON.stringify({ booking_id: 'p', rating: 5, comment: '' }),
            }),
        );
    });

    // C10
    test('shows the visit packages with remaining visits and expiry', async () => {
        route({
            '/me/visit-packages': () => ({
                ok: true,
                data: {
                    packages: [
                        {
                            id: 'pkg-1', plan_id: 'plan', plan_name_ru: 'Абонемент 10', plan_name_ky: null, plan_name_en: null,
                            remaining_visits: 7, plan_visit_count: 10, valid_until: '2099-03-01', purchased_at: 'x', created_at: 'x', is_active: true,
                        },
                        {
                            id: 'pkg-2', plan_id: 'plan', plan_name_ru: 'Старый', plan_name_ky: null, plan_name_en: null,
                            remaining_visits: 0, plan_visit_count: 5, valid_until: '2020-01-01', purchased_at: 'x', created_at: 'x', is_active: false,
                        },
                    ],
                },
            }),
        });

        renderScreen();

        expect(await screen.findByText('Абонемент 10')).toBeTruthy();
        expect(screen.getByText('Осталось визитов: 7 из 10')).toBeTruthy();
        expect(screen.getByText(/^Действует до /)).toBeTruthy();
        expect(screen.queryByText('Старый')).toBeNull();
        fireEvent.press(screen.getByText('Показать истёкшие'));
        expect(screen.getByText('Старый')).toBeTruthy();
        expect(mockedApiRequest).toHaveBeenCalledWith('/me/visit-packages?status=all');
    });

    // C13
    test('accepts a staff invitation through the web endpoint', async () => {
        let invitations = [{ id: 'inv-1', business_name: 'Салон', branch_name: 'Центр' }];
        route({
            '/staff-invitations/inv-1/accept': () => {
                invitations = [];
                return { ok: true, data: { is_active: true } };
            },
            '/staff-invitations': () => ({ ok: true, data: { invitations } }),
        });

        renderScreen();

        expect(await screen.findByText('Салон')).toBeTruthy();
        expect(screen.getByText('Филиал: Центр')).toBeTruthy();
        fireEvent.press(screen.getByText('Принять'));

        expect(await screen.findByText('Вы в команде. Кабинет сотрудника открыт.')).toBeTruthy();
        expect(mockedApiRequest).toHaveBeenCalledWith('/staff-invitations/inv-1/accept', { method: 'POST' });
    });

    test('declines a staff invitation only after confirmation', async () => {
        route({
            '/staff-invitations/inv-1/decline': () => ({ ok: true }),
            '/staff-invitations': () => ({ ok: true, data: { invitations: [{ id: 'inv-1', business_name: 'Салон', branch_name: null }] } }),
        });
        mockConfirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

        renderScreen();

        fireEvent.press(await screen.findByText('Отклонить'));
        await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
        expect(mockedApiRequest).not.toHaveBeenCalledWith('/staff-invitations/inv-1/decline', expect.anything());

        fireEvent.press(screen.getByText('Отклонить'));
        await waitFor(() =>
            expect(mockedApiRequest).toHaveBeenCalledWith('/staff-invitations/inv-1/decline', { method: 'POST' }),
        );
    });

    // Sign-out uses the same ConfirmContext dialog as Profile.
    test('signs out after the shared confirmation dialog', async () => {
        route({});
        mockConfirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

        renderScreen();

        fireEvent.press(await screen.findByText('Выйти из аккаунта'));
        await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' })));
        expect(signOutSafely).not.toHaveBeenCalled();

        fireEvent.press(screen.getByText('Выйти из аккаунта'));
        await waitFor(() => expect(signOutSafely).toHaveBeenCalledTimes(1));
    });
});
