import { runStaffCreateHttp } from '@/lib/staffCreateHttpService';

jest.mock('@/lib/authBiz', () => ({
  getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/staffCreateService', () => ({
  runStaffCreate: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
  logError: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { runStaffCreate } from '@/lib/staffCreateService';
import { getServiceClient } from '@/lib/supabaseService';

describe('staffCreateHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBizContextForManagers as jest.Mock).mockResolvedValue({
      supabase: { from: jest.fn() },
      userId: 'manager-1',
      bizId: 'biz-1',
    });
    (getServiceClient as jest.Mock).mockReturnValue({
      auth: { admin: { listUsers: jest.fn() } },
      from: jest.fn(),
    });
  });

  test('parses request and delegates to staff create service', async () => {
    (runStaffCreate as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: 'staff-1', user_linked: false, schedule_initialized: true, schedule_days_created: 14, schedule_error: null },
    });

    const response = await runStaffCreateHttp(
      new Request('http://localhost/api/staff/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          full_name: 'Staff',
          branch_id: 'branch-1',
          is_active: true,
        }),
      }),
    );
    const body = await response.json();

    expect(runStaffCreate).toHaveBeenCalledWith({
      supabase: { from: expect.any(Function) },
      admin: { auth: { admin: { listUsers: expect.any(Function) } }, from: expect.any(Function) },
      userId: 'manager-1',
      bizId: 'biz-1',
      body: {
        full_name: 'Staff',
        branch_id: 'branch-1',
        is_active: true,
      },
    });
    expect(response.status).toBe(200);
    expect(body.data.id).toBe('staff-1');
  });

  test('returns validation error for invalid json', async () => {
    const response = await runStaffCreateHttp(
      new Request('http://localhost/api/staff/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });
});
