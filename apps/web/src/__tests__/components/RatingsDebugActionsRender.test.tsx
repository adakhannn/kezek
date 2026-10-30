/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import { RatingsDebugClient } from '@/app/admin/ratings-debug/RatingsDebugClient';

const router = { push: jest.fn(), replace: jest.fn() };
const search = new URLSearchParams();
jest.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => search }));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => ({ t: (_key: string, fallback: string) => fallback }) }));
const fetchMock = jest.fn();
const data = {
  days: 7, window_since: '2026-10-14',
  with_null_rating: { staff: [{ id: 'staff-1', full_name: null, biz_id: 'biz-1', branch_id: 'branch-1', last_rating_recalculated_at: null }], branches: [{ id: 'branch-1', name: 'Branch control', biz_id: 'biz-1', last_rating_recalculated_at: null }], businesses: [{ id: 'biz-1', name: 'Business control', slug: null, last_rating_recalculated_at: null }] },
  without_metrics_since: { staff: [], branches: [], businesses: [], total_count: { staff: 0, branches: 0, businesses: 0 } }, recent_errors: [],
};
beforeEach(() => { jest.clearAllMocks(); global.fetch = fetchMock; fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, data }) }); });
test('all three entity types render existing row actions without executing commands', async () => {
  render(<RatingsDebugClient />);
  await screen.findByText('Business control');
  expect(screen.getAllByRole('button', { name: 'Пересчитать', exact: true })).toHaveLength(3);
  expect(screen.queryByText('[object Object]')).toBeNull();
  expect(screen.getByText('Branch control')).toBeTruthy(); expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  expect(fetchMock.mock.calls).toEqual([['/api/admin/ratings/debug-entities?days=7', { cache: 'no-store' }]]);
});
test('empty lists have no action buttons', async () => {
  fetchMock.mockResolvedValue({ status: 200, json: async () => ({ ok: true, data: { ...data, with_null_rating: { staff: [], branches: [], businesses: [] } } }) });
  render(<RatingsDebugClient />); await screen.findByText('Нет записей.');
  expect(screen.queryByRole('button', { name: 'Пересчитать', exact: true })).toBeNull();
});
test('read errors do not display stale row controls', async () => {
  fetchMock.mockResolvedValue({ status: 500, json: async () => ({ ok: false, error: 'Controlled read failure' }) });
  render(<RatingsDebugClient />); expect(await screen.findByText('Controlled read failure')).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Пересчитать', exact: true })).toBeNull());
});
