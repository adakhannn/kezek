import { runStaffRestoreHttp } from '@/lib/staffRestoreHttpService';

jest.mock('@/lib/authBiz', () => ({
  getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
  getRouteParamRequired: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
  getServiceClient: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/staffRestoreService', () => ({
  runStaffRestore: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { runStaffRestore } from '@/lib/staffRestoreService';

describe('staffRestoreHttpService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getRouteParamRequired as jest.Mock).mockResolvedValue('staff-1');
    (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-1' });
    (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue({ from: jest.fn() });
  });

  test('delegates restore flow to service', async () => {
    (runStaffRestore as jest.Mock).mockResolvedValue({ ok: true });

    const response = await runStaffRestoreHttp({ params: { id: 'staff-1' } });
    const body = await response.json();

    expect(runStaffRestore).toHaveBeenCalledWith(
      expect.objectContaining({
        bizId: 'biz-1',
        staffId: 'staff-1',
      }),
    );
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
