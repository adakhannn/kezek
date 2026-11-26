import { runMeVisitPackagesHttp } from '@/lib/meVisitPackagesHttpService';

jest.mock('@/lib/requestAuthContext', () => ({
  createRequestSupabaseClient: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/meVisitPackagesService', () => ({
  listCurrentUserVisitPackages: jest.fn(),
}));

import { listCurrentUserVisitPackages } from '@/lib/meVisitPackagesService';
import { createRequestSupabaseClient } from '@/lib/requestAuthContext';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

describe('meVisitPackagesHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue({ from: jest.fn() });
  });

  test('returns auth error when user is missing', async () => {
    (createRequestSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null } }) },
    });

    const response = await runMeVisitPackagesHttp(new Request('http://localhost/api/me/visit-packages'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('auth');
    expect(listCurrentUserVisitPackages).not.toHaveBeenCalled();
  });

  test('loads current user packages through service', async () => {
    const user = { id: 'user-1' };
    (createRequestSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
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
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ packages: [{ id: 'pkg-1' }] });
  });

  test('identifies the caller from the request, so the mobile Bearer token is accepted (C10)', async () => {
    (createRequestSupabaseClient as jest.Mock).mockResolvedValue({
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'app-user' } } }) },
    });
    (listCurrentUserVisitPackages as jest.Mock).mockResolvedValue({ ok: true, data: { packages: [] } });

    const req = new Request('http://localhost/api/me/visit-packages', { headers: { Authorization: 'Bearer token' } });
    const response = await runMeVisitPackagesHttp(req);

    expect(createRequestSupabaseClient).toHaveBeenCalledWith(req);
    expect(listCurrentUserVisitPackages).toHaveBeenCalledWith(expect.objectContaining({ user: { id: 'app-user' }, includeAll: false }));
    expect(response.status).toBe(200);
  });
});
