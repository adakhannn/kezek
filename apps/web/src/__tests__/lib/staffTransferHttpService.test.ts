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
  const originalFlag = process.env.SCHEDULE_V2_ENABLED;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.SCHEDULE_V2_ENABLED;
    else process.env.SCHEDULE_V2_ENABLED = originalFlag;
  });
  beforeEach(() => {
    delete process.env.SCHEDULE_V2_ENABLED;
    jest.clearAllMocks();
    (getRouteParamRequired as jest.Mock).mockResolvedValue('staff-1');
    (getBizContextForManagers as jest.Mock).mockResolvedValue({
      bizId: 'biz-1',
    });
    (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
  });

  test('explicit transfer uses one atomic command with actor from authenticated context', async () => {
    process.env.SCHEDULE_V2_ENABLED = 'true';
    const staff='00000000-0000-0000-0000-000000000001';
    const target='00000000-0000-0000-0000-000000000002';
    const previous='00000000-0000-0000-0000-000000000003';
    const rpc=jest.fn().mockResolvedValue({ data: { note: 'HOME_BRANCH_CHANGED_SCHEDULE_PRESERVED' }, error: null });
    (getServiceClient as jest.Mock).mockReturnValue({ rpc });
    (getRouteParamRequired as jest.Mock).mockResolvedValue(staff);
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-1', userId: 'verified-actor' });
    const response=await runStaffTransferHttp(new Request('http://localhost/api/transfer', {
      method:'POST',body:JSON.stringify({target_branch_id:target,expected_branch_id:previous,actor:'untrusted',copy_schedule:true}),
    }),{});
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('transfer_staff_home', {
      p_staff:staff,p_biz:'biz-1',p_actor:'verified-actor',p_expected_branch:previous,p_target:target,
    });
    expect(runStaffTransfer).not.toHaveBeenCalled();
  });

  test('stale explicit transfer returns conflict and does not fall back to legacy writes', async () => {
    process.env.SCHEDULE_V2_ENABLED = 'true';
    const id='00000000-0000-0000-0000-000000000001';
    (getRouteParamRequired as jest.Mock).mockResolvedValue(id);
    (getServiceClient as jest.Mock).mockReturnValue({ rpc: jest.fn().mockResolvedValue({error:{message:'SCHEDULE_STALE'}}) });
    const response=await runStaffTransferHttp(new Request('http://localhost/api/transfer', {
      method:'POST',body:JSON.stringify({target_branch_id:id,expected_branch_id:id}),
    }),{});
    expect(response.status).toBe(409);
    expect(runStaffTransfer).not.toHaveBeenCalled();
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
