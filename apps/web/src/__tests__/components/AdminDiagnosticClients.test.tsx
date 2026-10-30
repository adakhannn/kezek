/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MonitoringClient from '@/app/admin/monitoring/MonitoringClient';
import SystemHealthClient from '@/app/admin/system-health/SystemHealthClient';

const fetchMock = jest.fn();
beforeEach(() => { jest.clearAllMocks(); global.fetch = fetchMock; });

test('system health calls the existing administrative endpoint path', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    render(<SystemHealthClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/admin/api/system-health', { cache: 'no-store' }));
    expect(await screen.findByText('HTTP 503')).toBeTruthy();
});

test('monitoring has readable labels and requests the canonical administrative paths in all tabs', async () => {
    fetchMock.mockImplementation(async (url: string) => ({ ok: true, json: async () => ({ ok: true,
        data: url.includes('/metrics?') || url.includes('/finance-logs?') ? [] : null }) }));
    render(<MonitoringClient />);
    expect(screen.getByRole('heading', { name: 'Мониторинг и аналитика', exact: true })).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/admin/api/metrics/stats?endpoint=%2Fapi%2Fstaff%2Ffinance&windowMinutes=60'));
    expect(fetchMock).toHaveBeenCalledWith('/admin/api/metrics/auth-flow?windowHours=24');
    expect(await screen.findByText('Нет данных')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Метрики API', exact: true }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/admin/api/metrics?limit=50'));
    expect(await screen.findByText('Нет метрик')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Логи операций', exact: true }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/admin/api/finance-logs?limit=50'));
    expect(await screen.findByText('Нет логов')).toBeTruthy();
});
