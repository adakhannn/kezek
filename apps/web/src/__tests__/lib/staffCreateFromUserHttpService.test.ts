import { runStaffCreateFromUserHttp } from '@/lib/staffCreateFromUserHttpService';

jest.mock('@/lib/authBiz', () => ({
  getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/staffCreateFromUserService', () => ({
  runStaffCreateFromUser: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
  logError: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { runStaffCreateFromUser } from '@/lib/staffCreateFromUserService';
import { getServiceClient } from '@/lib/supabaseService';

describe('staffCreateFromUserHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getBizContextForManagers as jest.Mock).mockResolvedValue({
      bizId: 'biz-1',
    });
    (getServiceClient as jest.Mock).mockReturnValue({ auth: { admin: {} }, from: jest.fn() });
  });

  test('delegates valid request to staff create from user service', async () => {
    (runStaffCreateFromUser as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        id: 'staff-1',
        schedule_initialized: true,
        schedule_days_created: 14,
        schedule_error: null,
      },
    });

    const response = await runStaffCreateFromUserHttp(
      new Request('http://localhost/api/staff/create-from-user', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          user_id: 'user-1',
          branch_id: 'branch-1',
        }),
      }),
    );
    const body = await response.json();

    expect(runStaffCreateFromUser).toHaveBeenCalledWith({
      admin: { auth: { admin: {} }, from: expect.any(Function) },
      bizId: 'biz-1',
      body: {
        user_id: 'user-1',
        branch_id: 'branch-1',
      },
    });
    expect(response.status).toBe(200);
    expect(body.data.id).toBe('staff-1');
  });

  test('returns validation error for invalid json', async () => {
    const response = await runStaffCreateFromUserHttp(
      new Request('http://localhost/api/staff/create-from-user', {
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
