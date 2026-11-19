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

jest.mock('@/lib/log', () => ({
  logError: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

const staff = '00000000-0000-0000-0000-000000000001';
const target = '00000000-0000-0000-0000-000000000002';
const previous = '00000000-0000-0000-0000-000000000003';

function transfer(body: unknown) {
  return runStaffTransferHttp(new Request('http://localhost/api/staff/transfer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }), {});
}

describe('staffTransferHttpService', () => {
  const originalFlag = process.env.SCHEDULE_V2_ENABLED;
  let rpc: jest.Mock;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.SCHEDULE_V2_ENABLED;
    else process.env.SCHEDULE_V2_ENABLED = originalFlag;
  });
  beforeEach(() => {
    delete process.env.SCHEDULE_V2_ENABLED;
    jest.clearAllMocks();
    rpc = jest.fn().mockResolvedValue({ data: { note: 'HOME_BRANCH_CHANGED_SCHEDULE_PRESERVED' }, error: null });
    (getServiceClient as jest.Mock).mockReturnValue({ rpc, from: jest.fn(() => { throw new Error('no table writes outside the command'); }) });
    (getRouteParamRequired as jest.Mock).mockResolvedValue(staff);
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-1', userId: 'verified-actor' });
  });

  test.each([['with explicit scheduling', 'true'], ['without explicit scheduling', undefined]])(
    'a transfer %s is one atomic command with the actor from the authenticated context',
    async (_label, flag) => {
      if (flag) process.env.SCHEDULE_V2_ENABLED = flag;
      const response = await transfer({ target_branch_id: target, expected_branch_id: previous, actor: 'untrusted', copy_schedule: true });
      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({ note: 'HOME_BRANCH_CHANGED_SCHEDULE_PRESERVED' });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith('transfer_staff_home', {
        p_staff: staff, p_biz: 'biz-1', p_actor: 'verified-actor', p_expected_branch: previous, p_target: target,
      });
    },
  );

  test.each([
    ['SCHEDULE_STALE', 409],
    ['SCHEDULE_BOOKING_CONFLICT', 409],
    ['SCHEDULE_FUTURE_ASSIGNMENT', 409],
    ['SCHEDULE_FORBIDDEN', 403],
    ['SCHEDULE_NOT_FOUND', 404],
    ['SCHEDULE_INVALID_BRANCH', 400],
    ['SCHEDULE_SAME_BRANCH', 400],
  ])('%s from the command answers %i and writes nothing else', async (code, status) => {
    rpc.mockResolvedValue({ data: null, error: { message: code } });
    const response = await transfer({ target_branch_id: target, expected_branch_id: previous });
    expect(response.status).toBe(status);
    expect((await response.json()).error).toBe(code);
  });

  test('an unknown command failure is a 500 saying nothing changed', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'deadlock detected' } });
    const response = await transfer({ target_branch_id: target, expected_branch_id: previous });
    expect(response.status).toBe(500);
    expect((await response.json()).message).toContain('Изменения не применены');
  });

  test.each([
    ['no expected branch', { target_branch_id: target }],
    ['a target that is not a UUID', { target_branch_id: 'branch-2', expected_branch_id: previous }],
  ])('%s is a validation error without calling the command', async (_label, body) => {
    const response = await transfer(body);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('validation');
    expect(rpc).not.toHaveBeenCalled();
  });

  test('returns validation error for invalid json', async () => {
    const response = await transfer('{');
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('validation');
    expect(rpc).not.toHaveBeenCalled();
  });
});
