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
    from: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
    (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
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
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
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
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { role_key: 'super_admin', biz_id: null },
        error: null,
      }),
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
    const filters:Record<string,unknown>={};
    const query={select:jest.fn().mockReturnThis(),eq:jest.fn((key:string,value:string)=>{filters[key]=value;return query;}),is:jest.fn().mockReturnThis(),limit:jest.fn().mockReturnThis(),maybeSingle:jest.fn(async()=>({data:filters.user_id===undefined?{role_key:'super_admin',biz_id:null}:null,error:null}))};
    mockSupabase.from.mockReturnValue(query);
    (runAdminHealthCheck as jest.Mock).mockResolvedValue({ok:true,data:{ok:true}});
    const response=await runAdminHealthCheckHttp();
    expect(response.status).toBe(403);expect(filters.user_id).toBe('current-user');
    expect(getServiceClient).not.toHaveBeenCalled();expect(runAdminHealthCheck).not.toHaveBeenCalled();
  });
  test('preserves role read error before any privileged read',async()=>{
    mockSupabase.auth.getUser.mockResolvedValue({data:{user:{id:'current-user'}}});
    mockSupabase.from.mockReturnValue({select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),is:jest.fn().mockReturnThis(),limit:jest.fn().mockReturnThis(),maybeSingle:jest.fn().mockResolvedValue({data:null,error:{message:'role read unavailable'}})});
    const response=await runAdminHealthCheckHttp();
    expect(response.status).toBe(400);expect((await response.json()).error).toBe('internal');
    expect(getServiceClient).not.toHaveBeenCalled();
  });
  test('preserves health read service failure in standard HTTP envelope',async()=>{
    mockSupabase.auth.getUser.mockResolvedValue({data:{user:{id:'current-user'}}});
    mockSupabase.from.mockReturnValue({select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),is:jest.fn().mockReturnThis(),limit:jest.fn().mockReturnThis(),maybeSingle:jest.fn().mockResolvedValue({data:{role_key:'super_admin',biz_id:null},error:null})});
    (runAdminHealthCheck as jest.Mock).mockResolvedValue({ok:false,statusCode:500,errorType:'internal',message:'read unavailable'});
    const response=await runAdminHealthCheckHttp();expect(response.status).toBe(500);expect((await response.json()).error).toBe('internal');
  });
});
