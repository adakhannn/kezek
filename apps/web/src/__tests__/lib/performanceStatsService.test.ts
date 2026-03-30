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
      maybeSingle: jest.fn().mockResolvedValue({
        data: { is_super_admin: false },
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
      maybeSingle: jest.fn().mockResolvedValue({
        data: { is_super_admin: true },
        error: null,
      }),
    });
    (getOperations as jest.Mock).mockReturnValue(['operation1', 'operation2']);
    (getPerformanceStats as jest.Mock)
      .mockReturnValueOnce({ count: 10, avgTime: 100, minTime: 50, maxTime: 200 })
      .mockReturnValueOnce({ count: 5, avgTime: 150, minTime: 100, maxTime: 250 });

    const result = await getPerformanceStatsSnapshot(client);

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
});
