/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import FunnelAnalyticsPage from '@/app/admin/funnel-analytics/page';
import { getBizContextForManagers } from '@/lib/authBiz';

jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn() }));
jest.mock('@/app/admin/funnel-analytics/FunnelAnalyticsClient', () => ({
    __esModule: true,
    default: () => <h1>Global funnel analytics</h1>,
}));

it('renders the global admin page without requiring a selected business', () => {
    render(<FunnelAnalyticsPage />);
    expect(screen.getByRole('heading', { name: 'Global funnel analytics' })).toBeTruthy();
    expect(getBizContextForManagers).not.toHaveBeenCalled();
});
