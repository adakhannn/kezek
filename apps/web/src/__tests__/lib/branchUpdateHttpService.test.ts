import { runBranchUpdateHttp } from '@/lib/branchUpdateHttpService';

jest.mock('@/lib/authBiz', () => ({
  getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
  getRouteParamRequired: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/branchUpdateService', () => ({
  updateBranch: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { updateBranch } from '@/lib/branchUpdateService';

describe('branchUpdateHttpService', () => {
  const mockServiceClient = { from: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (getRouteParamRequired as jest.Mock).mockResolvedValue('branch-id');
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-id' });
    (getServiceClient as jest.Mock).mockReturnValue(mockServiceClient);
  });

  test('delegates valid request to branch update service', async () => {
    (updateBranch as jest.Mock).mockResolvedValue({ ok: true, data: {} });

    const response = await runBranchUpdateHttp(
      new Request('http://localhost/api/branches/branch-id/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Branch',
          address: 'Street',
          is_active: true,
          lat: 43.23,
          lon: 76.89,
        }),
      }),
      { params: { id: 'branch-id' } },
    );
    const body = await response.json();

    expect(updateBranch).toHaveBeenCalledWith({
      admin: mockServiceClient,
      branchId: 'branch-id',
      bizId: 'biz-id',
      body: {
        name: 'Branch',
        address: 'Street',
        is_active: true,
        lat: 43.23,
        lon: 76.89,
      },
    });
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  test('maps service errors to api error response', async () => {
    (updateBranch as jest.Mock).mockResolvedValue({
      ok: false,
      error: 'validation',
      message: 'bad coords',
      status: 400,
    });

    const response = await runBranchUpdateHttp(
      new Request('http://localhost/api/branches/branch-id/update', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: { id: 'branch-id' } },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('validation');
  });
});
