import { asDbClient } from '@/__tests__/helpers/dbClientMock';
import { runPromotionsDebugRoute } from '@/lib/promotionsDebugRouteService';
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
      rpc: jest.fn(),
    };
  }

  test('rejects anonymous user', async () => {
    const authClient = createAuthClient();
    authClient.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const result = await runPromotionsDebugRoute({
      authClient: asDbClient(authClient),
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
    authClient.rpc.mockResolvedValueOnce({ data: false, error: null });

    const result = await runPromotionsDebugRoute({
      authClient: asDbClient(authClient),
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

  test('rejects a business-scoped super_admin role and rpc errors', async () => {
    const authClient = createAuthClient();
    authClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    authClient.rpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });

    const result = await runPromotionsDebugRoute({
      authClient: asDbClient(authClient),
      serviceClient: {} as never,
      requestUrl: 'http://localhost/api/admin/promotions/debug?bizId=123e4567-e89b-12d3-a456-426614174000',
    });

    expect(authClient.rpc).toHaveBeenCalledWith('is_super_admin');
    expect(result).toMatchObject({ ok: false, error: 'forbidden', status: 403 });
    expect(loadPromotionsDebugData).not.toHaveBeenCalled();
  });

  test('validates missing identifiers', async () => {
    const authClient = createAuthClient();
    authClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    authClient.rpc.mockResolvedValueOnce({ data: true, error: null });

    const result = await runPromotionsDebugRoute({
      authClient: asDbClient(authClient),
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
    authClient.rpc.mockResolvedValueOnce({ data: true, error: null });
    (loadPromotionsDebugData as jest.Mock).mockResolvedValue({
      client: { id: 'client-id' },
    });

    const serviceClient = {} as never;
    const result = await runPromotionsDebugRoute({
      authClient: asDbClient(authClient),
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
