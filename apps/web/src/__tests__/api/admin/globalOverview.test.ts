import { GET } from '@/app/admin/api/analytics/overview/route';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';
import { getCached, setCached } from '@/lib/simpleCache';

jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn(async () => { throw new Error('No business preference'); }) }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/simpleCache', () => ({ getCached: jest.fn(), setCached: jest.fn() }));

const range = jest.fn();
const stats = { select: jest.fn().mockReturnThis(), gte: jest.fn().mockReturnThis(), lte: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), range };
function caller(user: string | null = 'current', rowUser = 'current', scope: string | null = null, error: unknown = null) {
  const filters: Record<string, unknown> = {};
  const role = { select: jest.fn().mockReturnThis(), eq: jest.fn((k, v) => { filters[k] = v; return role; }), is: jest.fn((k, v) => { filters[k] = v; return role; }), limit: jest.fn().mockReturnThis(), maybeSingle: async () => ({ data: filters.user_id === rowUser && filters.role_key === 'super_admin' && filters.biz_id === scope ? { role_key: 'super_admin', biz_id: scope } : null, error }) };
  (createSupabaseServerClient as jest.Mock).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: user ? { id: user } : null } }) }, from: () => role });
  return filters;
}
function request(query = 'startDate=2026-10-01&endDate=2026-10-20') { return GET(new Request('http://localhost/admin/api/analytics/overview?' + query)); }
beforeEach(() => {
  jest.clearAllMocks(); caller();
  (getCached as jest.Mock).mockReturnValue(null);
  (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn(() => stats) });
  range.mockResolvedValue({ data: [], error: null });
});

test('global SA needs no business preference and receives an explicit all-business scope', async () => {
  const filters = caller(); const response = await request(); const body = await response.json();
  expect(response.status).toBe(200); expect(body.data.scope).toBe('all_businesses');
  expect(body.data.byDay).toEqual([]); expect(filters).toEqual({ user_id: 'current', role_key: 'super_admin', biz_id: null });
  expect(stats.gte).toHaveBeenCalledWith('date', '2026-10-01'); expect(stats.lte).toHaveBeenCalledWith('date', '2026-10-20');
  expect(stats.order).toHaveBeenCalledWith('biz_id', { ascending: true });
});
test.each([[null, 'current', null, null, 401], ['current', 'other', null, null, 403], ['current', 'current', 'biz', null, 403], ['current', 'current', null, new Error('private role detail'), 400]])('denies caller before global cache/client', async (user, rowUser, scope, error, status) => {
  caller(user as string | null, rowUser as string, scope as string | null, error);
  const response = await request(); expect(response.status).toBe(status);
  expect(getCached).not.toHaveBeenCalled(); expect(getServiceClient).not.toHaveBeenCalled();
  expect(JSON.stringify(await response.json())).not.toContain('private role detail');
});
test.each(['branchIds=branch', 'bizId=550e8400-e29b-41d4-a716-446655440000', 'startDate=2026-02-30', 'startDate=2026-10-20&endDate=2026-10-01'])('rejects unsupported/invalid scope or window: %s', async query => {
  expect((await request(query)).status).toBe(400); expect(getServiceClient).not.toHaveBeenCalled();
});
test('read failure is not a successful empty report and is not cached', async () => {
  range.mockResolvedValue({ data: null, error: { message: 'private DB detail' } });
  const response = await request(); expect(response.status).toBe(500); expect(setCached).not.toHaveBeenCalled();
  expect(JSON.stringify(await response.json())).not.toContain('private DB detail');
});
test('cache is global-version/window scoped but still checked only after authorization', async () => {
  (getCached as jest.Mock).mockReturnValue({ scope: 'all_businesses', byDay: [] });
  expect((await request()).status).toBe(200); expect(getCached).toHaveBeenCalledWith('admin_global_overview:v1:2026-10-01:2026-10-20');
  expect(getServiceClient).not.toHaveBeenCalled();
});
