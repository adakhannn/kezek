/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import FunnelAnalyticsClient from '@/app/admin/funnel-analytics/FunnelAnalyticsClient';

const fetchMock = jest.fn();

beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, data: {
            funnel: [],
            summary: { totalViews: 0, totalBookings: 0, overallConversionRate: 0, totalEvents: 0 },
        } }),
    });
});

it('loads the global funnel from the actual Next admin API route', async () => {
    render(<FunnelAnalyticsClient />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/admin/api/funnel-analytics?', { cache: 'no-store' }));
    expect(await screen.findByRole('heading', { name: 'Воронка конверсии' })).toBeTruthy();
});

it('keeps source filtering on that same route', async () => {
    render(<FunnelAnalyticsClient />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'quickdesk' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/admin/api/funnel-analytics?source=quickdesk', { cache: 'no-store' }));
});
