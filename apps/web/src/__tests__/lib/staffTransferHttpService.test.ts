import { runStaffTransferHttp } from '@/lib/staffTransferHttpService';

jest.mock('@/lib/authBiz', () => ({
  getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
  getRouteParamRequired: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/staffTransferService', () => ({
  runStaffTransfer: jest.fn(),
}));

jest.mock('@/lib/log', () => ({
  logError: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { runStaffTransfer } from '@/lib/staffTransferService';

describe('staffTransferHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRouteParamRequired as jest.Mock).mockResolvedValue('staff-1');
    (getBizContextForManagers as jest.Mock).mockResolvedValue({
      bizId: 'biz-1',
    });
    (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
  });

  test('delegates parsed request to transfer service', async () => {
    (runStaffTransfer as jest.Mock).mockResolvedValue({
      ok: true,
      data: { note: 'OK' },
    });

    const response = await runStaffTransferHttp(
      new Request('http://localhost/api/staff/staff-1/transfer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          target_branch_id: 'branch-2',
          copy_schedule: true,
        }),
      }),
      { params: { id: 'staff-1' } },
    );
    const body = await response.json();

    expect(runStaffTransfer).toHaveBeenCalledWith({
      admin: { from: expect.any(Function) },
      bizId: 'biz-1',
      staffId: 'staff-1',
      body: {
        target_branch_id: 'branch-2',
        copy_schedule: true,
      },
    });
    expect(response.status).toBe(200);
    expect(body.data.note).toBe('OK');
  });

  test('returns validation error for invalid json', async () => {
    const response = await runStaffTransferHttp(
      new Request('http://localhost/api/staff/staff-1/transfer', {
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
