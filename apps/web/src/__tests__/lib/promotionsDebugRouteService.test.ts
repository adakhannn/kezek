import {
  runPromotionsDebugRoute,
  type PromotionsDebugAuthClientLike,
} from '@/lib/promotionsDebugRouteService';
import { loadPromotionsDebugData } from '@/lib/promotionsDebugService';

jest.mock('@/lib/promotionsDebugService', () => ({
  loadPromotionsDebugData: jest.fn(),
}));

describe('promotionsDebugRouteService', () => {
  function createAuthClient() {
    return {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    } as unknown as jest.Mocked<PromotionsDebugAuthClientLike>;
  }

  test('rejects anonymous user', async () => {
    const authClient = createAuthClient();
    authClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const result = await runPromotionsDebugRoute({
      authClient,
      serviceClient: {} as never,
      requestUrl: 'http://localhost/api/admin/promotions/debug?clientId=123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result).toEqual({
      ok: false,
      error: 'auth',
      message: 'Не авторизован',
      status: 401,
    });
  });

  test('rejects non super admin user', async () => {
    const authClient = createAuthClient();
    authClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    authClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });

    const result = await runPromotionsDebugRoute({
      authClient,
      serviceClient: {} as never,
      requestUrl: 'http://localhost/api/admin/promotions/debug?clientId=123e4567-e89b-12d3-a456-426614174000',
    });

    expect(result).toEqual({
      ok: false,
      error: 'forbidden',
      message: 'Доступ запрещен: только для суперадмина',
      status: 403,
    });
  });

  test('validates missing identifiers', async () => {
    const authClient = createAuthClient();
    authClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    authClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { roles: { key: 'super_admin' } },
        error: null,
      }),
    });

    const result = await runPromotionsDebugRoute({
      authClient,
      serviceClient: {} as never,
      requestUrl: 'http://localhost/api/admin/promotions/debug',
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'Требуется clientId, branchId или bizId',
      status: 400,
    });
  });

  test('delegates to promotions debug data service', async () => {
    const authClient = createAuthClient();
    authClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    authClient.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { roles: { key: 'super_admin' } },
        error: null,
      }),
    });
    (loadPromotionsDebugData as jest.Mock).mockResolvedValue({
      client: { id: 'client-id' },
    });

    const serviceClient = {} as never;
    const result = await runPromotionsDebugRoute({
      authClient,
      serviceClient,
      requestUrl: 'http://localhost/api/admin/promotions/debug?clientId=123e4567-e89b-12d3-a456-426614174000',
    });

    expect(loadPromotionsDebugData).toHaveBeenCalledWith({
      serviceClient,
      clientId: '123e4567-e89b-12d3-a456-426614174000',
      branchId: null,
      bizId: null,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        client: { id: 'client-id' },
      },
    });
  });
});
