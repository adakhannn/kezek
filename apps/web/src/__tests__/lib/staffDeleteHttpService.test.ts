import { runStaffDeleteHttp } from '@/lib/staffDeleteHttpService';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/authBiz', () => ({
  getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
  getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/staffDeleteService', () => ({
  runStaffDeleteService: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { runStaffDeleteService } from '@/lib/staffDeleteService';

describe('staffDeleteHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    (getRouteParamUuid as jest.Mock).mockResolvedValue('staff-1');
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-1' });
    (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    (createClient as jest.Mock).mockReturnValue({ from: jest.fn() });
  });

  test('delegates delete flow to service', async () => {
    (runStaffDeleteService as jest.Mock).mockResolvedValue({ ok: true });

    const response = await runStaffDeleteHttp({ params: { id: 'staff-1' } });
    const body = await response.json();

    expect(runStaffDeleteService).toHaveBeenCalledWith(
      expect.objectContaining({
        bizId: 'biz-1',
        staffId: 'staff-1',
      }),
    );
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
