import { runStaffUpdateHttp } from '@/lib/staffUpdateHttpService';

jest.mock('@/lib/authBiz', () => ({
  getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
  getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/staffUpdateService', () => ({
  runStaffUpdate: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
  logError: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { runStaffUpdate } from '@/lib/staffUpdateService';

describe('staffUpdateHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRouteParamUuid as jest.Mock).mockResolvedValue('staff-1');
    (getBizContextForManagers as jest.Mock).mockResolvedValue({
      supabase: { from: jest.fn() },
      userId: 'manager-1',
      bizId: 'biz-1',
    });
    (getServiceClient as jest.Mock).mockReturnValue({
      auth: { admin: { listUsers: jest.fn() } },
    });
  });

  test('parses request and delegates to service', async () => {
    (runStaffUpdate as jest.Mock).mockResolvedValue({
      ok: true,
      data: { user_linked: true },
    });

    const response = await runStaffUpdateHttp(
      new Request('http://localhost/api/staff/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          full_name: 'Test',
          branch_id: 'branch-1',
          is_active: true,
        }),
      }),
      { params: { id: 'staff-1' } },
    );
    const body = await response.json();

    expect(runStaffUpdate).toHaveBeenCalledWith({
      supabase: { from: expect.any(Function) },
      admin: { auth: { admin: { listUsers: expect.any(Function) } } },
      staffId: 'staff-1',
      userId: 'manager-1',
      bizId: 'biz-1',
      body: {
        full_name: 'Test',
        branch_id: 'branch-1',
        is_active: true,
      },
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ user_linked: true });
  });

  test('returns validation error for invalid json', async () => {
    const response = await runStaffUpdateHttp(
      new Request('http://localhost/api/staff/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
      { params: { id: 'staff-1' } },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });
});
