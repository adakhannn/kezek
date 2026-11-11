import { runAdminHealthCheckHttp } from '@/lib/adminHealthCheckHttpService';

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/adminHealthCheckService', () => ({
  runAdminHealthCheck: jest.fn(),
}));

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';
import { runAdminHealthCheck } from '@/lib/adminHealthCheckService';

describe('adminHealthCheckHttpService', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
    rpc: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
    (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
  });

  test('auth error with a stale user stops before permission and privileged reads', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'stale' } }, error: new Error('expired') });
    expect((await runAdminHealthCheckHttp()).status).toBe(401);
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
    expect(getServiceClient).not.toHaveBeenCalled();
  });

  test('returns auth error when user is missing', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const response = await runAdminHealthCheckHttp();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('auth');
    expect(getServiceClient).not.toHaveBeenCalled();
  });

  test('returns forbidden when user is not super admin', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockSupabase.rpc.mockResolvedValue({
        data: false,
        error: null,
      });

    const response = await runAdminHealthCheckHttp();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('forbidden');
    expect(getServiceClient).not.toHaveBeenCalled();
  });

  test('delegates to health-check service for super admin', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
    mockSupabase.rpc.mockResolvedValue({
        data: true,
        error: null,
      });
    (runAdminHealthCheck as jest.Mock).mockResolvedValue({
      ok: true,
      data: { ok: true, alerts: [], checks: {}, services: {}, timestamp: '2026-03-27T00:00:00.000Z' },
    });

    const response = await runAdminHealthCheckHttp();
    const body = await response.json();

    expect(runAdminHealthCheck).toHaveBeenCalledWith({
      admin: { from: expect.any(Function) },
    });
    expect(response.status).toBe(200);
    expect(body.data.ok).toBe(true);
  });

  test('does not authorize from another users global role', async()=>{
    mockSupabase.auth.getUser.mockResolvedValue({data:{user:{id:'current-user'}}});
    mockSupabase.rpc.mockResolvedValue({data:false,error:null});
    (runAdminHealthCheck as jest.Mock).mockResolvedValue({ok:true,data:{ok:true}});
    const response=await runAdminHealthCheckHttp();
    expect(response.status).toBe(403);expect(mockSupabase.rpc).toHaveBeenCalledWith('is_super_admin');
    expect(getServiceClient).not.toHaveBeenCalled();expect(runAdminHealthCheck).not.toHaveBeenCalled();
  });
  test('preserves role read error before any privileged read',async()=>{
    mockSupabase.auth.getUser.mockResolvedValue({data:{user:{id:'current-user'}}});
    mockSupabase.rpc.mockResolvedValue({data:false,error:{message:'role read unavailable'}});
    const response=await runAdminHealthCheckHttp();
    expect(response.status).toBe(400);expect((await response.json()).error).toBe('internal');
    expect(getServiceClient).not.toHaveBeenCalled();
  });
  test('preserves health read service failure in standard HTTP envelope',async()=>{
    mockSupabase.auth.getUser.mockResolvedValue({data:{user:{id:'current-user'}}});
    mockSupabase.rpc.mockResolvedValue({data:true,error:null});
    (runAdminHealthCheck as jest.Mock).mockResolvedValue({ok:false,statusCode:500,errorType:'internal',message:'read unavailable'});
    const response=await runAdminHealthCheckHttp();expect(response.status).toBe(500);expect((await response.json()).error).toBe('internal');
  });
});
