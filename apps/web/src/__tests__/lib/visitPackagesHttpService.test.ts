import { runListVisitPackagesHttp, runSellVisitPackageHttp } from '@/lib/visitPackagesHttpService';

jest.mock('@/lib/routeParams', () => ({
  getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/withManagerContext', () => ({
  withManagerContext: jest.fn(),
}));

jest.mock('@/lib/visitPackagesService', () => ({
  listVisitPackages: jest.fn(),
  sellVisitPackage: jest.fn(),
}));

jest.mock('@/lib/validation/apiValidation', () => ({
  validateQuery: jest.fn(),
  validateRequest: jest.fn(),
}));

import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';
import { listVisitPackages, sellVisitPackage } from '@/lib/visitPackagesService';
import { validateQuery, validateRequest } from '@/lib/validation/apiValidation';

describe('visitPackagesHttpService', () => {
  const admin = { from: jest.fn() };
  const bizId = 'biz-uuid';

  beforeEach(() => {
    jest.clearAllMocks();
    (withManagerContext as jest.Mock).mockImplementation(async (_req, _action, callback) =>
      callback({ admin, bizId }),
    );
  });

  test('lists visit packages via query validation and manager context', async () => {
    const req = new Request('http://localhost/api/dashboard/visit-packages?status=active');
    (validateQuery as jest.Mock).mockReturnValue({
      success: true,
      data: { status: 'active' },
    });
    (listVisitPackages as jest.Mock).mockResolvedValue({
      ok: true,
      data: { packages: [] },
    });

    const response = await runListVisitPackagesHttp(req);
    const body = await response.json();

    expect(listVisitPackages).toHaveBeenCalledWith({
      admin,
      bizId,
      query: { status: 'active' },
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ packages: [] });
  });

  test('sells visit package via param + body validation', async () => {
    const req = new Request('http://localhost/api/dashboard/clients/client-1/visit-packages', {
      method: 'POST',
    });
    const context = { params: Promise.resolve({ clientId: 'client-1' }) };
    (getRouteParamUuid as jest.Mock).mockResolvedValue('client-1');
    (validateRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { plan_id: 'plan-1' },
    });
    (sellVisitPackage as jest.Mock).mockResolvedValue({
      ok: true,
      data: { package: { id: 'pkg-1' } },
    });

    const response = await runSellVisitPackageHttp(req, context);
    const body = await response.json();

    expect(sellVisitPackage).toHaveBeenCalledWith({
      admin,
      bizId,
      clientId: 'client-1',
      body: { plan_id: 'plan-1' },
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ package: { id: 'pkg-1' } });
  });
});
