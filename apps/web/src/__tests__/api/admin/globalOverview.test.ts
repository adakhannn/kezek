import { GET } from '@/app/admin/api/analytics/overview/route';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';
import { getCached, setCached } from '@/lib/simpleCache';

jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn(async () => { throw new Error('No business preference'); }) }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/simpleCache', () => ({ getCached: jest.fn(), setCached: jest.fn() }));

const reportRpc = jest.fn();
function caller(user: string | null = 'current', rowUser = 'current', scope: string | null = null, error: unknown = null) {
  const rpc=jest.fn().mockResolvedValue({data:user===rowUser&&scope===null,error});
  (createSupabaseServerClient as jest.Mock).mockResolvedValue({auth:{getUser:async()=>({data:{user:user?{id:user}:null},error:null})},rpc});
  return rpc;
}
function request(query = 'startDate=2026-10-01&endDate=2026-10-20') { return GET(new Request('http://localhost/admin/api/analytics/overview?' + query)); }
beforeEach(() => {
  jest.clearAllMocks(); caller();
  (getCached as jest.Mock).mockReturnValue(null);
  (getServiceClient as jest.Mock).mockReturnValue({ rpc: reportRpc });
  reportRpc.mockResolvedValue({ data: { rows: [], activeBusinesses: 0 }, error: null });
});

test('global SA needs no business preference and receives an explicit all-business scope', async () => {
  const filters = caller(); const response = await request(); const body = await response.json();
  expect(response.status).toBe(200); expect(body.data.scope).toBe('all_businesses');
  expect(body.data.byDay).toEqual([]); expect(filters).toHaveBeenCalledWith('is_super_admin');
  expect(reportRpc).toHaveBeenCalledWith('read_analytics_report_snapshot', { p_date_from: '2026-10-01', p_date_to: '2026-10-20', p_biz_id: null, p_branch_id: null, p_kind: 'global' });
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
  reportRpc.mockResolvedValue({ data: null, error: { message: 'private DB detail' } });
  const response = await request(); expect(response.status).toBe(500); expect(setCached).not.toHaveBeenCalled();
  expect(JSON.stringify(await response.json())).not.toContain('private DB detail');
});
test('cache is global-version/window scoped but still checked only after authorization', async () => {
  (getCached as jest.Mock).mockReturnValue({ scope: 'all_businesses', byDay: [] });
  expect((await request()).status).toBe(200); expect(getCached).toHaveBeenCalledWith('admin_global_overview:v1:2026-10-01:2026-10-20');
  expect(getServiceClient).not.toHaveBeenCalled();
});

test('stale user alongside auth error cannot reach permission RPC, cache or privileged data', async () => {
  const rpc = jest.fn();
  (createSupabaseServerClient as jest.Mock).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'stale' } }, error: new Error('expired') }) }, rpc });
  expect((await request()).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled(); expect(getCached).not.toHaveBeenCalled(); expect(getServiceClient).not.toHaveBeenCalled();
});
