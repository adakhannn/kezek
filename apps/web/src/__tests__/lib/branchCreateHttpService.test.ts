import { runBranchCreateHttp } from '@/lib/branchCreateHttpService';

jest.mock('@/lib/authBiz', () => ({
  getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/branchCreateService', () => ({
  createBranch: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { createBranch } from '@/lib/branchCreateService';
import { getServiceClient } from '@/lib/supabaseService';

describe('branchCreateHttpService', () => {
  const mockSupabase = {
    rpc: jest.fn(),
    from: jest.fn(),
  };
  const mockServiceClient = { from: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    (getBizContextForManagers as jest.Mock).mockResolvedValue({
      supabase: mockSupabase,
      userId: 'user-id',
      bizId: 'biz-id',
    });
    (getServiceClient as jest.Mock).mockReturnValue(mockServiceClient);
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
  });

  test('returns forbidden when user is not super admin', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: false,
      error: null,
    });

    const response = await runBranchCreateHttp(
      new Request('http://localhost/api/branches/create', {
        method: 'POST',
        body: JSON.stringify({ name: 'Branch' }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('forbidden');
  });

  test('delegates valid request to createBranch service', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: true,
      error: null,
    });
    (createBranch as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: 'branch-id' },
    });

    const response = await runBranchCreateHttp(
      new Request('http://localhost/api/branches/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Branch' }),
      }),
    );
    const body = await response.json();

    expect(createBranch).toHaveBeenCalledWith({
      admin: mockServiceClient,
      bizId: 'biz-id',
      body: { name: 'Branch' },
    });
    expect(response.status).toBe(200);
    expect(body.data.id).toBe('branch-id');
  });

  test('allows the owner of the selected business to create a branch', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: false, error: null });
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'biz-id' }, error: null }),
    });
    (createBranch as jest.Mock).mockResolvedValue({
      ok: true,
      data: { id: 'owner-branch-id' },
    });

    const response = await runBranchCreateHttp(
      new Request('http://localhost/api/branches/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Owner Branch', address: 'Manual address' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createBranch).toHaveBeenCalledWith(expect.objectContaining({
      bizId: 'biz-id',
      body: { name: 'Owner Branch', address: 'Manual address' },
    }));
  });
});
