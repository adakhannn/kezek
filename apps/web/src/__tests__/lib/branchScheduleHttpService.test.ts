import { runGetBranchScheduleHttp, runSaveBranchScheduleHttp } from '@/lib/branchScheduleHttpService';

jest.mock('@/lib/authBiz', () => ({
  getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
  getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/branchScheduleService', () => ({
  getBranchSchedule: jest.fn(),
  saveBranchSchedule: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { getBranchSchedule, saveBranchSchedule } from '@/lib/branchScheduleService';

describe('branchScheduleHttpService', () => {
  const context = { params: { id: 'branch-1' } };
  const admin = { from: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (getRouteParamUuid as jest.Mock).mockResolvedValue('branch-1');
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-1' });
    (getServiceClient as jest.Mock).mockReturnValue(admin);
  });

  test('loads branch schedule via service layer', async () => {
    (getBranchSchedule as jest.Mock).mockResolvedValue({
      ok: true,
      data: { schedule: [{ day_of_week: 1, intervals: [], breaks: [] }] },
    });

    const response = await runGetBranchScheduleHttp(new Request('http://localhost'), context);
    const body = await response.json();

    expect(getBranchSchedule).toHaveBeenCalledWith({
      admin,
      branchId: 'branch-1',
      bizId: 'biz-1',
    });
    expect(response.status).toBe(200);
    expect(body.data.schedule).toHaveLength(1);
  });

  test('saves branch schedule via service layer', async () => {
    (saveBranchSchedule as jest.Mock).mockResolvedValue({
      ok: true,
      data: {},
    });

    const response = await runSaveBranchScheduleHttp(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schedule: [{ day_of_week: 1, intervals: [], breaks: [] }],
        }),
      }),
      context,
    );
    const body = await response.json();

    expect(saveBranchSchedule).toHaveBeenCalledWith({
      admin,
      branchId: 'branch-1',
      bizId: 'biz-1',
      body: {
        schedule: [{ day_of_week: 1, intervals: [], breaks: [] }],
      },
    });
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
