import React from 'react';
import { Alert, Linking } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import DashboardScreen from '../../screens/DashboardScreen';
import { availableManagerActions } from '../../screens/dashboard/managerBookings';
import { apiRequest } from '../../lib/api';
import { resetCurrentBusiness } from '../../screens/manage/currentBusiness';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner-1' } }) }));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

const mockConfirm = jest.fn();
const mockShowToast = jest.fn();
jest.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => ({ confirm: mockConfirm }) }));
jest.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;

const BIZ = { id: 'biz-1', name: 'Low Fade', slug: 'low-fade', address: 'Ош', phones: ['+996555000111'], tz: 'Asia/Bishkek', role: 'owner' };
const OTHER = { id: 'biz-2', name: 'Barber One', slug: 'barber-one', address: null, phones: null, tz: 'Asia/Bishkek', role: 'admin' };

const booking = (id: string, values: Record<string, unknown> = {}) => ({
    id, status: 'hold', start_at: '2030-01-01T05:00:00Z', end_at: '2030-01-01T05:30:00Z',
    client_name: 'Айбек', client_phone: '+996555123456', service: { name_ru: 'Стрижка' },
    staff_name: 'Мастер Азамат', branch_name: 'Центр', ...values,
});

type Routes = { businesses?: unknown[]; bookings?: Record<string, unknown[]>; fail?: string };

function mockApi(routes: Routes) {
    api.mockImplementation(async (endpoint: string) => {
        if (routes.fail && endpoint.startsWith(routes.fail)) throw Object.assign(new Error('Ошибка сервера'), { status: 500 });
        if (endpoint === '/api/mobile/manager/businesses') return { ok: true, data: routes.businesses ?? [] };
        if (endpoint.startsWith('/api/mobile/manager/bookings')) {
            const params = new URLSearchParams(endpoint.split('?')[1]);
            const rows = routes.bookings?.[`${params.get('bizId')}:${params.get('scope')}`] ?? [];
            return { ok: true, data: rows, timezone: 'Asia/Bishkek', page: { offset: 0, limit: 30, has_more: false, next_offset: null } };
        }
        return { ok: true };
    });
}

const renderScreen = () => render(
    <QueryClientProvider client={createTestQueryClient()}>
        <DashboardScreen />
    </QueryClientProvider>,
);

beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
});

describe('DashboardScreen (O1)', () => {
    test('someone who manages no business sees the not-owner state', async () => {
        mockApi({ businesses: [] });
        renderScreen();
        expect(await screen.findByText('Вы не являетесь владельцем бизнеса')).toBeTruthy();
    });

    test('a failed businesses read is an error with retry, not "no business"', async () => {
        mockApi({ fail: '/api/mobile/manager/businesses' });
        renderScreen();
        expect(await screen.findByText('Не удалось загрузить кабинет бизнеса')).toBeTruthy();
        expect(screen.getByText('Повторить')).toBeTruthy();
    });

    test('shows today\'s bookings of the business with client, master and contact actions; upcoming on the other tab', async () => {
        mockApi({ businesses: [BIZ], bookings: {
            'biz-1:today': [booking('b-today')],
            'biz-1:upcoming': [booking('b-later', { status: 'confirmed', service: { name_ru: 'Борода' } })],
        } });
        renderScreen();

        expect(await screen.findByText('Стрижка')).toBeTruthy();
        expect(screen.getByText('Low Fade')).toBeTruthy();
        expect(screen.getByText('Владелец')).toBeTruthy();
        expect(screen.getByText('Клиент: Айбек')).toBeTruthy();
        expect(screen.getByText('Мастер: Мастер Азамат')).toBeTruthy();
        expect(screen.getByText('+996 555 123 456')).toBeTruthy();
        expect(screen.getByText('Позвонить')).toBeTruthy();
        expect(screen.getByText('Ожидает подтверждения')).toBeTruthy();
        expect(screen.getByText('Открыть веб-кабинет')).toBeTruthy();

        fireEvent.press(screen.getByText('Предстоящие'));
        expect(await screen.findByText('Борода')).toBeTruthy();
        expect(api).toHaveBeenCalledWith('/api/mobile/manager/bookings?bizId=biz-1&scope=upcoming&limit=30&offset=0');
    });

    test('confirm calls the Bearer-capable confirm endpoint and reloads the feed', async () => {
        mockApi({ businesses: [BIZ], bookings: { 'biz-1:today': [booking('b-1')] } });
        renderScreen();

        fireEvent.press(await screen.findByText('Подтвердить'));

        await waitFor(() => expect(api).toHaveBeenCalledWith('/api/bookings/b-1/confirm', { method: 'POST' }));
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Запись подтверждена', 'success'));
        const feedReads = api.mock.calls.filter(([endpoint]) => endpoint.startsWith('/api/mobile/manager/bookings'));
        expect(feedReads.length).toBeGreaterThanOrEqual(2);
    });

    test('cancel asks first; declining sends nothing', async () => {
        mockConfirm.mockResolvedValue(false);
        mockApi({ businesses: [BIZ], bookings: { 'biz-1:today': [booking('b-1', { status: 'confirmed' })] } });
        renderScreen();

        fireEvent.press(await screen.findByText('Отменить'));

        await waitFor(() => expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Отменить запись?', variant: 'danger' })));
        expect(api).not.toHaveBeenCalledWith('/api/bookings/b-1/cancel', expect.anything());
    });

    test('attendance of a started booking is marked through mark-attendance; a server refusal is shown', async () => {
        mockApi({ businesses: [BIZ], bookings: { 'biz-1:today': [booking('b-past', { status: 'confirmed', start_at: '2020-01-01T05:00:00Z', end_at: '2020-01-01T05:30:00Z' })] } });
        renderScreen();

        fireEvent.press(await screen.findByText('Не пришёл'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/api/bookings/b-past/mark-attendance', expect.objectContaining({
            method: 'POST', body: JSON.stringify({ attended: false }),
        })));
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Отмечено: клиент не пришёл', 'success'));

        api.mockImplementationOnce(async () => { throw Object.assign(new Error('Доступ запрещен'), { status: 403 }); });
        fireEvent.press(await screen.findByText('Пришёл'));
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('У вас недостаточно прав для этого действия.', 'error'));
    });

    test('tapping a booking opens its details; several businesses can be switched', async () => {
        mockApi({ businesses: [BIZ, OTHER], bookings: { 'biz-1:today': [booking('b-1')], 'biz-2:today': [booking('b-2', { service: { name_ru: 'Укладка' } })] } });
        renderScreen();

        fireEvent.press(await screen.findByTestId('manager-booking-b-1'));
        expect(mockNavigate).toHaveBeenCalledWith('BookingDetails', { id: 'b-1' });

        fireEvent.press(screen.getByText('Barber One'));
        expect(await screen.findByText('Укладка')).toBeTruthy();
        expect(screen.getByText('Администратор')).toBeTruthy();
    });

    test('an empty day and a failed feed read are told apart', async () => {
        mockApi({ businesses: [BIZ] });
        renderScreen();
        expect(await screen.findByText('Сегодня записей нет')).toBeTruthy();

        mockApi({ businesses: [BIZ], fail: '/api/mobile/manager/bookings' });
        fireEvent.press(screen.getByText('Предстоящие'));
        expect(await screen.findByText('Не удалось загрузить записи бизнеса')).toBeTruthy();
    });

    test('opens the web dashboard through a one-time handoff, never with the app tokens', async () => {
        const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
        mockApi({ businesses: [BIZ] });
        api.mockImplementation(async (endpoint: string) => {
            if (endpoint === '/auth/web-handoff') return { ok: true, url: 'https://kezek.vercel.app/auth/handoff?code=one-time-code' };
            if (endpoint === '/api/mobile/manager/businesses') return { ok: true, data: [BIZ] };
            return { ok: true, data: [], page: { next_offset: null } };
        });
        renderScreen();
        fireEvent.press(await screen.findByText('Открыть веб-кабинет'));

        await waitFor(() => expect(openUrl).toHaveBeenCalledWith('https://kezek.vercel.app/auth/handoff?code=one-time-code'));
        expect(api).toHaveBeenCalledWith('/auth/web-handoff', { method: 'POST', body: JSON.stringify({ next: '/select-business' }) });
    });

    test('refuses to open anything but the handoff page', async () => {
        const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
        api.mockImplementation(async (endpoint: string) => {
            if (endpoint === '/auth/web-handoff') return { ok: true, url: 'https://evil.example/phish' };
            if (endpoint === '/api/mobile/manager/businesses') return { ok: true, data: [BIZ] };
            return { ok: true, data: [], page: { next_offset: null } };
        });
        renderScreen();
        fireEvent.press(await screen.findByText('Открыть веб-кабинет'));

        await waitFor(() => expect(alert).toHaveBeenCalled());
        expect(openUrl).not.toHaveBeenCalled();
    });

    test('the hub lists the management sections; the full bookings open after the business is made current', async () => {
        resetCurrentBusiness();
        mockApi({ businesses: [BIZ] });
        renderScreen();

        for (const key of ['overview', 'bookings', 'finance', 'analytics', 'roleApplications', 'visitPackages']) {
            expect(await screen.findByTestId(`manage-${key}`)).toBeTruthy();
        }
        fireEvent.press(screen.getByText('Все записи'));
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('ManageBookings', { bizId: 'biz-1', bizName: 'Low Fade', tz: 'Asia/Bishkek' }));
        expect(api).toHaveBeenCalledWith('/me/current-business', expect.objectContaining({ method: 'POST', body: JSON.stringify({ bizId: 'biz-1' }) }));
    });
});

describe('availableManagerActions', () => {
    const now = new Date('2030-01-01T06:00:00Z');
    test.each([
        ['hold', '2030-01-01T07:00:00Z', ['confirm', 'cancel']],
        ['hold', '2030-01-01T05:00:00Z', ['confirm', 'attended', 'no_show', 'cancel']],
        ['confirmed', '2030-01-01T07:00:00Z', ['cancel']],
        ['confirmed', '2030-01-01T06:00:00Z', ['attended', 'no_show', 'cancel']],
        ['paid', '2030-01-01T05:00:00Z', []],
        ['no_show', '2030-01-01T05:00:00Z', []],
        ['cancelled', '2030-01-01T07:00:00Z', []],
    ] as const)('%s starting %s: %j', (status, start, expected) => {
        expect(availableManagerActions({ status, start_at: start }, now)).toEqual(expected);
    });
});
