import { getPerformanceStatsSnapshot, type PerformanceStatsAuthClientLike } from '@/lib/performanceStatsService';
import { getPerformanceStats, getOperations } from '@/lib/performance';

jest.mock('@/lib/performance', () => ({
  getPerformanceStats: jest.fn(),
  getOperations: jest.fn(),
}));

describe('performanceStatsService', () => {
  function createClient() {
    return {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    } as unknown as jest.Mocked<PerformanceStatsAuthClientLike>;
  }

  test('rejects anonymous user', async () => {
    const client = createClient();
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const result = await getPerformanceStatsSnapshot(client);

    expect(result).toEqual({
      ok: false,
      error: 'auth',
      message: 'Не авторизован',
      status: 401,
    });
  });

  test('rejects non-super-admin user', async () => {
    const client = createClient();
    client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    client.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });

    const result = await getPerformanceStatsSnapshot(client);

    expect(result).toEqual({
      ok: false,
      error: 'forbidden',
      message: 'Доступ запрещен',
      status: 403,
    });
  });

  test('returns performance stats for super-admin', async () => {
    const client = createClient();
    client.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    client.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { role_key: 'super_admin', biz_id: null },
        error: null,
      }),
    });
    (getOperations as jest.Mock).mockReturnValue(['operation1', 'operation2']);
    (getPerformanceStats as jest.Mock)
      .mockReturnValueOnce({ count: 10, avgTime: 100, minTime: 50, maxTime: 200 })
      .mockReturnValueOnce({ count: 5, avgTime: 150, minTime: 100, maxTime: 250 });

    const result = await getPerformanceStatsSnapshot(client);

    expect(client.from).toHaveBeenCalledWith('user_roles_with_user');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.stats).toHaveLength(2);
      expect(result.data.stats[0]).toEqual({
        operation: 'operation1',
        count: 10,
        avgTime: 100,
        minTime: 50,
        maxTime: 200,
      });
      expect(typeof result.data.timestamp).toBe('number');
    }
  });

  test.each([
    ['another users global role', 'other-user', 'super_admin', null],
    ['business-scoped role', 'current-user', 'super_admin', 'business-id'],
    ['different role', 'current-user', 'admin', null],
  ])('denies %s using all caller role filters', async (_label, rowUser, roleKey, bizId) => {
    const client = createClient();
    client.auth.getUser.mockResolvedValue({ data: { user: { id: 'current-user' } } });
    const filters: Record<string, unknown> = {};
    const query = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn((key: string, value: string) => { filters[key] = value; return query; }),
      is: jest.fn((key: string, value: null) => { filters[key] = value; return query; }),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => ({
        data: filters.user_id === rowUser && filters.role_key === roleKey && filters.biz_id === bizId
          ? { role_key: roleKey, biz_id: bizId } : null,
        error: null,
      })),
    };
    client.from.mockReturnValue(query);
    const result = await getPerformanceStatsSnapshot(client);
    expect(filters).toEqual({ user_id: 'current-user', role_key: 'super_admin', biz_id: null });
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  test('fails closed on a role read error even if a row is present', async () => {
    const client = createClient();
    client.auth.getUser.mockResolvedValue({ data: { user: { id: 'current-user' } } });
    const query = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { role_key: 'super_admin', biz_id: null }, error: new Error('read failed') }),
    };
    client.from.mockReturnValue(query);
    expect(await getPerformanceStatsSnapshot(client)).toMatchObject({ ok: false, status: 403 });
  });
});
