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

  test('recomputes today across Bishkek midnight in the same process', async () => {
    jest.useFakeTimers();
    const previousTimezone = process.env.NEXT_PUBLIC_TZ;
    process.env.NEXT_PUBLIC_TZ = 'Asia/Bishkek';
    try {
      (createSupabaseClients as jest.Mock).mockResolvedValue({
        supabase: { auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } },
        admin: {},
      });
      (listCurrentUserVisitPackages as jest.Mock).mockResolvedValue({ ok: true, data: { packages: [] } });
      jest.setSystemTime(new Date('2026-11-09T17:59:59Z'));
      await runMeVisitPackagesHttp(new Request('http://localhost/api/me/visit-packages'));
      jest.setSystemTime(new Date('2026-11-09T18:00:00Z'));
      await runMeVisitPackagesHttp(new Request('http://localhost/api/me/visit-packages'));
      expect(listCurrentUserVisitPackages).toHaveBeenNthCalledWith(1, expect.objectContaining({ today: '2026-11-09' }));
      expect(listCurrentUserVisitPackages).toHaveBeenNthCalledWith(2, expect.objectContaining({ today: '2026-11-10' }));
    } finally {
      jest.useRealTimers();
      if (previousTimezone === undefined) delete process.env.NEXT_PUBLIC_TZ;
      else process.env.NEXT_PUBLIC_TZ = previousTimezone;
    }
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
