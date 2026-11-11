import { GET } from '@/app/api/admin/ratings/jobs/route';
import {
  createMockRequest,
  expectErrorResponse,
  expectSuccessResponse,
  setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/ratingsJobsService', () => ({
  getRatingsJobs: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

import { getRatingsJobs } from '@/lib/ratingsJobsService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

describe('/api/admin/ratings/jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
  });

  test('returns 401 for anonymous user', async () => {
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const res = await GET(createMockRequest('http://localhost/api/admin/ratings/jobs', { method: 'GET' }));
    await expectErrorResponse(res, 401, 'auth');
  });

  test('returns jobs payload', async () => {
    const rpc=jest.fn().mockResolvedValue({data:true,error:null});
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
      rpc,
    });
    (getRatingsJobs as jest.Mock).mockResolvedValue({
      ok: true,
      data: { jobs: [{ id: 'job-1' }] },
    });

    const res = await GET(createMockRequest('http://localhost/api/admin/ratings/jobs', { method: 'GET' }));
    const body = await expectSuccessResponse(res, 200);
    expect(body.data).toEqual({ jobs: [{ id: 'job-1' }] });
    expect(rpc).toHaveBeenCalledWith('is_super_admin');
  });

  test('denies an auth error even when a user object is present', async () => {
    const rpc = jest.fn();
    (createSupabaseServerClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: { message: 'invalid token' } }) },
      rpc,
    });
    const res = await GET(createMockRequest('http://localhost/api/admin/ratings/jobs', { method: 'GET' }));
    await expectErrorResponse(res, 401, 'auth');
    expect(rpc).not.toHaveBeenCalled();
    expect(getServiceClient).not.toHaveBeenCalled();
    expect(getRatingsJobs).not.toHaveBeenCalled();
  });
});
