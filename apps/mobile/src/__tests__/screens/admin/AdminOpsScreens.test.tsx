import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import { apiRequest } from '../../../lib/api';
import AdminAnalyticsScreen from '../../../screens/admin/ops/AdminAnalyticsScreen';
import AdminHealthCheckScreen from '../../../screens/admin/ops/AdminHealthCheckScreen';
import AdminRatingConfigScreen from '../../../screens/admin/ops/AdminRatingConfigScreen';
import AdminRatingsDebugScreen from '../../../screens/admin/ops/AdminRatingsDebugScreen';
import AdminSystemHealthScreen from '../../../screens/admin/ops/AdminSystemHealthScreen';
import { createTestQueryClient } from '../../testQueryClient';

jest.mock('../../../lib/api', () => ({ apiRequest: jest.fn() }));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useRoute: () => ({ params: {} }),
}));
const mockConfirm = jest.fn();
const mockShowToast = jest.fn();
jest.mock('../../../contexts/ConfirmContext', () => ({ useConfirm: () => ({ confirm: mockConfirm }) }));
jest.mock('../../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;
type Handler = (endpoint: string, options?: RequestInit) => unknown;
const mockApi = (handler: Handler) => api.mockImplementation(async (endpoint: string, options?: RequestInit) => handler(endpoint, options) as never);

const renderScreen = (Screen: React.ComponentType) => render(
    <QueryClientProvider client={createTestQueryClient()}>
        <Screen />
    </QueryClientProvider>,
);

jest.setTimeout(20000);

beforeEach(() => {
    jest.clearAllMocks();
    mockConfirm.mockResolvedValue(true);
});

const day = { homeViews: 10, businessPageViews: 5, bookingFlowStarts: 3, bookingsCreated: 2, promoBookings: 1, promoRevenue: 500 };

describe('super-admin screens', () => {
    test('analytics: the overview of every business, then the occupancy heatmap of the current business', async () => {
        mockApi((endpoint) => {
            if (endpoint.startsWith('/admin/api/analytics/overview')) {
                return { ok: true, data: {
                    summary: {
                        period: { startDate: '2026-10-27', endDate: '2026-11-26' },
                        bookings: { created: 12, confirmedOrPaid: 9 },
                        funnel: { homeViews: 100, businessPageViews: 40, bookingFlowStarts: 20, conversionHomeToBooking: 9 },
                        revenue: { total: 20000, promoBookings: 2, promoRevenue: 1000 },
                    },
                    byDay: [{ ...day, date: '2026-11-26', bookingsConfirmedOrPaid: 4, totalRevenue: 6000 }],
                } };
            }
            if (endpoint === '/me/current-business') return { ok: true, data: { currentBizId: 'biz-1', businesses: [{ id: 'biz-1', name: 'Low Fade' }] } };
            if (endpoint === '/api/dashboard/branches/list') return { ok: true, data: [{ id: 'br-1', name: 'Центр' }] };
            if (endpoint.startsWith('/admin/api/analytics/load')) {
                return { ok: true, data: { period: { startDate: '2026-10-27', endDate: '2026-11-26' }, points: [
                    { date: '2026-11-26', hour: 10, bookingsCount: 3, promoBookingsCount: 0 },
                ] } };
            }
            return { ok: true, data: {} };
        });
        renderScreen(AdminAnalyticsScreen);

        expect(await screen.findByText('Брони (успешные)', {}, { timeout: 8000 })).toBeTruthy();
        expect(screen.getByText('9.00%')).toBeTruthy();
        expect(screen.getByLabelText('2026-11-26: 4')).toBeTruthy();
        expect(api).toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/api\/analytics\/overview\?startDate=\d{4}-\d{2}-\d{2}&endDate=/));
        // No second title under the header.
        expect(screen.queryByText('Аналитика бизнеса')).toBeNull();

        fireEvent.press(screen.getByText('Загрузка'));
        expect(await screen.findByText('Текущий бизнес: Low Fade', {}, { timeout: 5000 })).toBeTruthy();
        expect(await screen.findByLabelText('2026-11-26: 3 броней, пик в 10:00', {}, { timeout: 5000 })).toBeTruthy();
        expect(screen.getByText('Центр')).toBeTruthy();
        fireEvent.press(screen.getByTestId('admin-heatmap-row-2026-11-26'));
        expect(screen.getByText('2026-11-26, 10:00 — 3 броней')).toBeTruthy();
    });

    test('system health shows the overall status and opens the monitoring', async () => {
        mockApi(() => ({ ok: true, data: {
            ok: false,
            timestamp: '2026-11-26T08:00:00Z',
            cronJobs: {
                shifts: { ok: true, openShiftsOlderThan2Days: 0, lastCheckDate: '2026-11-26' },
                ratings: { ok: false, staffLastMetricDate: null, branchLastMetricDate: null, bizLastMetricDate: null, daysSinceLastMetric: null },
            },
            apiMetrics: { ok: true, totalRequests: 120, errorRate: 1.5, avgDuration: 230, p95Duration: 900, p99Duration: 1500, recentErrors: 2 },
            uiErrors: { ok: true, recentErrors: 0, lastErrorDate: null },
            integrations: {
                whatsapp: { ok: true, configured: true, providerReachable: true, lastSuccessDate: null, recentFailures: 0 },
                telegram: { ok: false, configured: false, providerReachable: false, lastSuccessDate: null, recentFailures: 3 },
            },
        } }));
        renderScreen(AdminSystemHealthScreen);

        expect(await screen.findByText('Обнаружены проблемы в одном или нескольких компонентах.')).toBeTruthy();
        expect(screen.getByText('Рейтинги никогда не пересчитывались')).toBeTruthy();
        expect(screen.getByText('1.50s')).toBeTruthy();
        expect(screen.getByText('Провайдер не настроен')).toBeTruthy();
        fireEvent.press(screen.getByText('Мониторинг'));
        expect(mockNavigate).toHaveBeenCalledWith('AdminMonitoring');
    });

    test('a forbidden health check is an error with the server message, never empty data', async () => {
        mockApi(() => { throw Object.assign(new Error('Доступ запрещен'), { status: 403 }); });
        renderScreen(AdminHealthCheckScreen);
        expect(await screen.findByText('Ошибка health check')).toBeTruthy();
    });

    test('rating settings: saving is confirmed, then the history recalculation is offered and confirmed', async () => {
        mockApi((endpoint, options) => {
            if (endpoint === '/admin/api/rating-config' && !options?.method) {
                return { ok: true, config: {
                    id: 'cfg-1', staff_reviews_weight: 35, staff_productivity_weight: 25, staff_loyalty_weight: 20,
                    staff_discipline_weight: 20, window_days: 30, is_active: true, valid_from: '2026-11-01T00:00:00Z',
                } };
            }
            return { ok: true };
        });
        renderScreen(AdminRatingConfigScreen);

        const reviews = await screen.findByTestId('admin-rating-reviews');
        fireEvent.changeText(reviews, '40');
        expect(screen.getByText('Сумма весов: 105.00%')).toBeTruthy();
        fireEvent.changeText(screen.getByTestId('admin-rating-productivity'), '20');
        expect(screen.getByText('Сумма весов: 100.00%')).toBeTruthy();

        fireEvent.press(screen.getByTestId('admin-rating-save'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/admin/api/rating-config', expect.objectContaining({ method: 'POST' })));
        expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Сохранить настройки?' }));
        const saved = api.mock.calls.find(([endpoint, options]) => endpoint === '/admin/api/rating-config' && options?.method === 'POST');
        expect(JSON.parse(String(saved?.[1]?.body))).toMatchObject({ staff_reviews_weight: 40, staff_productivity_weight: 20, window_days: 30 });

        fireEvent.press(await screen.findByText('14'));
        fireEvent.press(screen.getByTestId('admin-rating-recalc-run'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/api/admin/initialize-ratings', expect.objectContaining({ method: 'POST', body: JSON.stringify({ days_back: 14 }) })));
        expect(mockConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Пересчитать рейтинги?' }));
    });

    test('ratings debug: a NULL-rated entity is recalculated only after a confirmation', async () => {
        mockApi((endpoint) => {
            if (endpoint.startsWith('/api/admin/ratings/debug-entities')) {
                return { ok: true, data: {
                    days: 7,
                    window_since: '2026-11-19',
                    with_null_rating: {
                        staff: [{ id: 'st-1', full_name: 'Айгерим', biz_id: 'biz-1', branch_id: 'br-1', last_rating_recalculated_at: null }],
                        branches: [],
                        businesses: [],
                    },
                    without_metrics_since: { staff: [], branches: [], businesses: [], total_count: { staff: 0, branches: 0, businesses: 0 } },
                    recent_errors: [],
                } };
            }
            return { ok: true };
        });
        mockConfirm.mockResolvedValueOnce(false);
        renderScreen(AdminRatingsDebugScreen);

        expect(await screen.findByText('Айгерим')).toBeTruthy();
        fireEvent.press(screen.getByTestId('admin-debug-recalc-st-1'));
        await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(1));
        expect(api).not.toHaveBeenCalledWith('/api/admin/ratings/recalculate', expect.anything());

        fireEvent.press(screen.getByTestId('admin-debug-recalc-st-1'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/api/admin/ratings/recalculate', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ entity_type: 'staff', entity_id: 'st-1' }),
        })));
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Рейтинг пересчитан', 'success'));
    });
});
