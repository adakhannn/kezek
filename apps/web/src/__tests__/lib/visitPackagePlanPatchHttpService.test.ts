import { runVisitPackagePlanPatchHttp } from '@/lib/visitPackagePlanPatchHttpService';

jest.mock('@/lib/routeParams', () => ({
  getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/withManagerContext', () => ({
  withManagerContext: jest.fn(),
}));

jest.mock('@/lib/visitPackagePlansService', () => ({
  updateVisitPackagePlan: jest.fn(),
}));

jest.mock('@/lib/validation/apiValidation', () => ({
  validateRequest: jest.fn(),
}));

import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';
import { updateVisitPackagePlan } from '@/lib/visitPackagePlansService';
import { validateRequest } from '@/lib/validation/apiValidation';

describe('visitPackagePlanPatchHttpService', () => {
  const req = new Request('http://localhost/api/dashboard/visit-package-plans/plan-1', {
    method: 'PATCH',
  });
  const context = { params: Promise.resolve({ id: 'plan-1' }) };
  const admin = { from: jest.fn() };
  const bizId = 'biz-uuid';

  beforeEach(() => {
    jest.clearAllMocks();
    (getRouteParamUuid as jest.Mock).mockResolvedValue('plan-1');
    (withManagerContext as jest.Mock).mockImplementation(async (_req, _action, callback) =>
      callback({ admin, bizId }),
    );
  });

  test('loads route param and updates plan', async () => {
    (validateRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: { is_active: false },
    });
    (updateVisitPackagePlan as jest.Mock).mockResolvedValue({
      ok: true,
      data: { plan: { id: 'plan-1', is_active: false } },
    });

    const response = await runVisitPackagePlanPatchHttp(req, context);
    const body = await response.json();

    expect(getRouteParamUuid).toHaveBeenCalledWith(context, 'id');
    expect(updateVisitPackagePlan).toHaveBeenCalledWith({
      admin,
      planId: 'plan-1',
      bizId,
      body: { is_active: false },
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ plan: { id: 'plan-1', is_active: false } });
  });

  test('returns validation response for invalid PATCH body', async () => {
    const validationResponse = new Response(JSON.stringify({ error: 'bad' }), { status: 400 });
    (validateRequest as jest.Mock).mockResolvedValue({
      success: false,
      response: validationResponse,
    });

    const response = await runVisitPackagePlanPatchHttp(req, context);

    expect(response).toBe(validationResponse);
    expect(updateVisitPackagePlan).not.toHaveBeenCalled();
  });
});
