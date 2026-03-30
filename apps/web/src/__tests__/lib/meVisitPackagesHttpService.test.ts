import { runMeVisitPackagesHttp } from '@/lib/meVisitPackagesHttpService';

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseClients: jest.fn(),
}));

jest.mock('@/lib/meVisitPackagesService', () => ({
  listCurrentUserVisitPackages: jest.fn(),
}));

import { listCurrentUserVisitPackages } from '@/lib/meVisitPackagesService';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

describe('meVisitPackagesHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns auth error when user is missing', async () => {
    (createSupabaseClients as jest.Mock).mockResolvedValue({
      supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) } },
      admin: {},
    });

    const response = await runMeVisitPackagesHttp(new Request('http://localhost/api/me/visit-packages'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('auth');
  });

  test('loads current user packages through service', async () => {
    const user = { id: 'user-1' };
    (createSupabaseClients as jest.Mock).mockResolvedValue({
      supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) } },
      admin: { from: jest.fn() },
    });
    (listCurrentUserVisitPackages as jest.Mock).mockResolvedValue({
      ok: true,
      data: { packages: [{ id: 'pkg-1' }] },
    });

    const response = await runMeVisitPackagesHttp(
      new Request('http://localhost/api/me/visit-packages?status=all'),
    );
    const body = await response.json();

    expect(listCurrentUserVisitPackages).toHaveBeenCalledWith({
      admin: { from: expect.any(Function) },
      user,
      includeAll: true,
      today: expect.any(String),
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ packages: [{ id: 'pkg-1' }] });
  });
});
