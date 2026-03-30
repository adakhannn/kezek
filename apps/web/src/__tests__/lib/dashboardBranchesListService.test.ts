import { listDashboardBranches } from '@/lib/dashboardBranchesListService';

describe('dashboardBranchesListService', () => {
  test('returns sorted branch payload', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [{ id: 'branch-1', name: 'Main' }],
          error: null,
        }),
      }),
    };

    const result = await listDashboardBranches({
      supabase,
      bizId: 'biz-1',
    });

    expect(result).toEqual({
      ok: true,
      data: [{ id: 'branch-1', name: 'Main' }],
    });
  });

  test('returns server error when query fails', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'db failed' },
        }),
      }),
    };

    const result = await listDashboardBranches({
      supabase,
      bizId: 'biz-1',
    });

    expect(result).toEqual({
      ok: false,
      error: 'server',
      message: 'Failed to load branches',
      details: 'db failed',
      status: 500,
    });
  });
});
