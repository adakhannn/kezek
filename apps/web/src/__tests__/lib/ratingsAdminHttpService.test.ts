import { runRatingsJobsHttp, runRatingsStatusHttp } from '@/lib/ratingsAdminHttpService';

jest.mock('@/lib/ratingsDebugEntitiesService', () => ({
  ensureSuperAdminAccess: jest.fn(),
}));

jest.mock('@/lib/ratingsJobsService', () => ({
  getRatingsJobs: jest.fn(),
}));

jest.mock('@/lib/ratingsStatusService', () => ({
  getRatingsStatus: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

import { ensureSuperAdminAccess } from '@/lib/ratingsDebugEntitiesService';
import { getRatingsJobs } from '@/lib/ratingsJobsService';
import { getRatingsStatus } from '@/lib/ratingsStatusService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

describe('ratingsAdminHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads ratings status for super admin', async () => {
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { role_key: 'super_admin', biz_id: null },
          error: null,
        }),
      }),
    });
    (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    (getRatingsStatus as jest.Mock).mockResolvedValue({ healthy: true });

    const response = await runRatingsStatusHttp(
      new Request('http://localhost/api/admin/ratings/status?errors_days=3'),
    );
    const body = await response.json();

    expect(getRatingsStatus).toHaveBeenCalledWith(
      { from: expect.any(Function) },
      { errorsWindowDaysParam: '3' },
    );
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ healthy: true });
  });

  test('loads ratings jobs for super admin', async () => {
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    });
    (ensureSuperAdminAccess as jest.Mock).mockResolvedValue({ ok: true });
    (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    (getRatingsJobs as jest.Mock).mockResolvedValue({
      ok: true,
      data: { jobs: [] },
    });

    const response = await runRatingsJobsHttp();
    const body = await response.json();

    expect(getRatingsJobs).toHaveBeenCalledWith({
      admin: { from: expect.any(Function) },
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ jobs: [] });
  });
});
