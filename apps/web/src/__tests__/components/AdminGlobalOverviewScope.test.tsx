/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import OverviewPage from '@/app/admin/analytics/overview/page';
import { loadPersistedAnalyticsFilters, persistAnalyticsFilters } from '@/app/admin/analytics/filterPersistence';

jest.mock('@/app/admin/analytics/filterPersistence', () => ({ loadPersistedAnalyticsFilters: jest.fn(), persistAnalyticsFilters: jest.fn() }));
const fetchMock = jest.fn();
beforeEach(() => {
  jest.clearAllMocks(); global.fetch = fetchMock;
  (loadPersistedAnalyticsFilters as jest.Mock).mockReturnValue({ startDate: '2026-10-01', endDate: '2026-10-20', branchId: 'old-selected-branch' });
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { scope: 'all_businesses', summary: { period: {}, bookings: { created: 0, confirmedOrPaid: 0 }, funnel: { homeViews: 0, conversionHomeToBooking: 0 }, revenue: { total: 0, promoRevenue: 0, promoBookings: 0 } }, byDay: [] } }) });
});
test('global scope is explicit, retains both date inputs, does not fetch or claim branch filtering', async () => {
  const { container } = render(<OverviewPage />);
  expect(await screen.findByText(/Сводный обзор по всем бизнесам/)).toBeTruthy();
  expect(screen.queryByRole('combobox')).toBeNull();
  const inputs = container.querySelectorAll('input[type=date]'); expect(inputs).toHaveLength(2);
  expect((inputs[0] as HTMLInputElement).value).toBe('2026-10-01'); expect((inputs[1] as HTMLInputElement).value).toBe('2026-10-20');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/admin/api/analytics/overview?startDate=2026-10-01&endDate=2026-10-20', { cache: 'no-store' });
  expect(persistAnalyticsFilters).toHaveBeenCalledWith({ startDate: '2026-10-01', endDate: '2026-10-20' });
});
test('read failure remains an error rather than zero KPIs', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 500 }); render(<OverviewPage />);
  expect(await screen.findByText('HTTP 500')).toBeTruthy();
  await waitFor(() => expect(screen.queryByText('Брони (успешные)')).toBeNull());
});
