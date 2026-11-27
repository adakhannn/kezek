import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { apiRequest } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import ManageAnalyticsScreen from '../../../screens/manage/analytics/ManageAnalyticsScreen';
import ManageBookingsScreen from '../../../screens/manage/bookings/ManageBookingsScreen';
import { resetCurrentBusiness } from '../../../screens/manage/currentBusiness';
import ManageFinanceScreen from '../../../screens/manage/finance/ManageFinanceScreen';
import ManageOverviewScreen from '../../../screens/manage/overview/ManageOverviewScreen';
import ManageRoleApplicationsScreen from '../../../screens/manage/roleApplications/ManageRoleApplicationsScreen';
import ManageVisitPackagesScreen from '../../../screens/manage/visitPackages/ManageVisitPackagesScreen';
import { createTestQueryClient } from '../../testQueryClient';

jest.mock('../../../lib/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../../../lib/webLinks', () => ({ openWebAsCurrentUser: jest.fn(async () => undefined) }));

const mockNavigate = jest.fn();
const mockParams = { bizId: 'biz-1', bizName: 'Low Fade', tz: 'Asia/Bishkek' };
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useRoute: () => ({ params: mockParams }),
}));
const mockConfirm = jest.fn();
const mockShowToast = jest.fn();
jest.mock('../../../contexts/ConfirmContext', () => ({ useConfirm: () => ({ confirm: mockConfirm }) }));
jest.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;
const rpc = supabase.rpc as jest.Mock;

type Handler = (endpoint: string, options?: RequestInit) => unknown;
function mockApi(handler: Handler) {
    api.mockImplementation(async (endpoint: string, options?: RequestInit) => {
        if (endpoint === '/me/current-business') return { ok: true };
        return handler(endpoint, options);
    });
}

const renderScreen = (Screen: React.ComponentType) => render(
    <QueryClientProvider client={createTestQueryClient()}>
        <Screen />
    </QueryClientProvider>,
);

jest.setTimeout(20000);

beforeEach(() => {
    jest.clearAllMocks();
    resetCurrentBusiness();
    mockConfirm.mockResolvedValue(true);
});

describe('business management screens', () => {
    test('the overview makes the business current, shows today\'s numbers and opens the bookings', async () => {
        mockApi((endpoint) => endpoint === '/api/dashboard/overview' ? {
            ok: true,
            data: {
                staffApplications: { pending: 0 }, bizName: 'Low Fade', bizCity: 'Бишкек', formattedDate: '2026-11-26T06:00:00Z',
                timezone: 'Asia/Bishkek', bookingsToday: 4, staffActive: 3, servicesActive: 6, branchesCount: 1, needOnboarding: false,
                ratingScore: 72.5, ratingConfigScope: 'biz',
                ratingWeights: { reviews: 40, productivity: 30, loyalty: 20, discipline: 10, windowDays: 30 },
            },
        } : { ok: true });
        renderScreen(ManageOverviewScreen);

        expect(await screen.findByText('Сегодня кабинет уже в рабочем режиме')).toBeTruthy();
        expect(api).toHaveBeenCalledWith('/me/current-business', expect.objectContaining({ method: 'POST', body: JSON.stringify({ bizId: 'biz-1' }) }));
        expect(screen.getByLabelText('Текущий балл 72.5 / 100')).toBeTruthy();
        fireEvent.press(screen.getByTestId('overview-metric-bookingsToday'));
        expect(mockNavigate).toHaveBeenCalledWith('ManageBookings', { bizId: 'biz-1', bizName: 'Low Fade', tz: 'Asia/Bishkek' });
    });

    test('analytics: KPIs as tiles and the days as a bar chart with an axis', async () => {
        const point = { homeViews: 0, businessPageViews: 0, bookingFlowStarts: 0, bookingsCreated: 0, promoBookings: 0, promoRevenue: 0 };
        mockApi((endpoint) => {
            if (endpoint.startsWith('/api/dashboard/analytics/overview')) {
                return { ok: true, data: {
                    summary: {
                        period: { startDate: '2026-10-28', endDate: '2026-11-26' },
                        bookings: { created: 12, confirmedOrPaid: 9 },
                        funnel: { homeViews: 0, businessPageViews: 0, bookingFlowStarts: 0, conversionHomeToBooking: 4.5 },
                        revenue: { total: 15000, promoBookings: 0, promoRevenue: 0 },
                    },
                    byDay: [
                        { ...point, date: '2026-11-25', bookingsConfirmedOrPaid: 4, totalRevenue: 6000 },
                        { ...point, date: '2026-11-26', bookingsConfirmedOrPaid: 5, totalRevenue: 9000 },
                    ],
                } };
            }
            if (endpoint.startsWith('/api/dashboard/analytics/load')) {
                return { ok: true, data: { period: { startDate: '2026-10-28', endDate: '2026-11-26' }, points: [{ date: '2026-11-26', hour: 10, bookingsCount: 3, promoBookingsCount: 1 }] } };
            }
            return { ok: true, data: [] };
        });
        renderScreen(ManageAnalyticsScreen);

        expect(await screen.findByLabelText('Подтверждено, 9')).toBeTruthy();
        expect(screen.getByLabelText('2026-11-26: 5')).toBeTruthy();
        expect(screen.getByLabelText('10:00, Брони 3, Промо 1')).toBeTruthy();
        // Bookings and revenue by day: one row per day in each chart.
        expect(screen.getAllByText('26.11')).toHaveLength(2);
        // No second title under the header.
        expect(screen.queryByText('Аналитика бизнеса')).toBeNull();
    });

    test('a failed overview read is an error with retry, never zeros', async () => {
        mockApi(() => { throw Object.assign(new Error('boom'), { status: 500 }); });
        renderScreen(ManageOverviewScreen);
        expect(await screen.findByText('Не удалось загрузить показатели кабинета')).toBeTruthy();
    });

    test('finance shows the server totals and opens a master\'s stats', async () => {
        mockApi((endpoint) => endpoint.startsWith('/api/dashboard/finance/all') ? {
            ok: true,
            data: {
                dateFrom: '2026-11-26',
                branches: [],
                totalStats: { totalAmount: 10000, totalMaster: 4000, totalSalon: 6000, totalConsumables: 0, totalLateMinutes: 0, totalShifts: 1, totalOpenShifts: 1, totalClosedShifts: 0 },
                staffStats: [{ staffId: 'st-1', staffName: 'Азамат', isActive: true, shiftsCount: 1, openShiftsCount: 1, closedShiftsCount: 0, totalAmount: 10000, totalMaster: 4000, totalSalon: 6000, totalConsumables: 0, totalLateMinutes: 0 }],
            },
        } : { ok: true });
        renderScreen(ManageFinanceScreen);

        expect(await screen.findByText('Азамат')).toBeTruthy();
        expect(api).toHaveBeenCalledWith('/api/dashboard/finance/all?period=day');
        expect(screen.getAllByText('10 000 сом').length).toBeGreaterThan(0);
        fireEvent.press(screen.getByTestId('finance-staff-st-1'));
        expect(mockNavigate).toHaveBeenCalledWith('ManageFinanceStaff', expect.objectContaining({ staffId: 'st-1', bizId: 'biz-1' }));
    });

    test('staff applications: approve into a branch with the website body', async () => {
        const application = {
            id: 'app-1', applicant_user_id: 'u-1', requested_role: 'staff', status: 'pending', applicant_name: 'Нурлан',
            applicant_email: 'n@example.com', applicant_phone: null, message: 'Хочу работать', created_at: '2026-11-20T06:00:00Z',
            reviewed_at: null, review_note: null, prior_submission_count: 0, risk_flags: [], active_block_id: null,
        };
        mockApi((endpoint, options) => {
            if (endpoint === '/dashboard/api/role-applications') {
                return { ok: true, items: [application], branches: [{ id: 'br-1', name: 'Центр', address: 'Чуй 1', is_active: true }] };
            }
            if (endpoint.endsWith('/status')) return { ok: true, schedule_initialized: true, schedule_days_created: 21, body: options?.body };
            return { ok: true };
        });
        renderScreen(ManageRoleApplicationsScreen);

        fireEvent.press(await screen.findByText('Настроить и принять'));
        fireEvent.press(screen.getByText('Принять сотрудника'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/dashboard/api/role-applications/app-1/status', expect.objectContaining({ method: 'POST' })));
        const call = api.mock.calls.find(([endpoint]) => endpoint.endsWith('/status'));
        expect(JSON.parse(String(call?.[1]?.body))).toEqual({ action: 'approve', branch_id: 'br-1', is_active: true });
        expect(await screen.findByText('Сотрудник принят и получил рабочий кабинет. Расписание подготовлено на 21 день.')).toBeTruthy();
    });

    test('visit packages: list the types and deactivate after confirmation', async () => {
        mockApi((endpoint) => {
            if (endpoint === '/api/dashboard/visit-package-plans') {
                return { ok: true, data: { plans: [{ id: 'p-1', name_ru: '5 визитов', name_ky: null, name_en: null, visit_count: 5, validity_days: 30, discount_type: 'percent', discount_value: '10', service_id: null, branch_ids: null, is_active: true }] } };
            }
            return { ok: true };
        });
        renderScreen(ManageVisitPackagesScreen);

        expect(await screen.findByText('5 визитов')).toBeTruthy();
        expect(screen.getByText('Скидка: 10%')).toBeTruthy();
        fireEvent.press(screen.getByText('Деактивировать'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/api/dashboard/visit-package-plans/p-1', expect.objectContaining({
            method: 'PATCH', body: JSON.stringify({ is_active: false }),
        })));
        expect(mockConfirm).toHaveBeenCalled();
    });

    test('bookings list: the RPC page with filters, and a confirmed action', async () => {
        mockApi(() => ({ ok: true }));
        rpc.mockResolvedValue({
            data: { total: 1, rows: [{
                id: 'b-12345678', status: 'hold', start_at: '2030-01-01T05:00:00Z', end_at: '2030-01-01T05:30:00Z', branch_id: null,
                staff_id: 's-1', client_id: null, client_name: 'Айбек', client_phone: null, service: { name_ru: 'Стрижка', name_ky: null, name_en: null },
                staff_name: 'Азамат', booking_services: [],
            }] },
            error: null,
        });
        renderScreen(ManageBookingsScreen);

        fireEvent.press(await screen.findByText('Список'));
        expect(await screen.findByText('Стрижка')).toBeTruthy();
        expect(rpc).toHaveBeenCalledWith('dashboard_bookings_page', { p_biz_id: 'biz-1', p_status: 'notCancelled', p_limit: 30, p_offset: 0 });
        fireEvent.press(screen.getByText('Только ожидающие и подтверждённые'));
        await waitFor(() => expect(rpc).toHaveBeenCalledWith('dashboard_bookings_page', expect.objectContaining({ p_status: 'holdConfirmed' })));

        fireEvent.press(screen.getByText('Подтвердить'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/api/bookings/b-12345678/confirm', { method: 'POST' }));
        expect(mockShowToast).toHaveBeenCalledWith('Бронь подтверждена', 'success');
    });
});
