import { runCreateVisitPackagePlanHttp, runListVisitPackagePlansHttp } from '@/lib/visitPackagePlansHttpService';

jest.mock('@/lib/withManagerContext', () => ({
  withManagerContext: jest.fn(),
}));

jest.mock('@/lib/visitPackagePlansService', () => ({
  listVisitPackagePlans: jest.fn(),
  createVisitPackagePlan: jest.fn(),
}));

jest.mock('@/lib/validation/apiValidation', () => ({
  validateRequest: jest.fn(),
}));

import { withManagerContext } from '@/lib/withManagerContext';
import { createVisitPackagePlan, listVisitPackagePlans } from '@/lib/visitPackagePlansService';
import { validateRequest } from '@/lib/validation/apiValidation';

describe('visitPackagePlansHttpService', () => {
  const req = new Request('http://localhost/api/dashboard/visit-package-plans');
  const admin = { from: jest.fn() };
  const bizId = 'biz-uuid';

  beforeEach(() => {
    jest.clearAllMocks();
    (withManagerContext as jest.Mock).mockImplementation(async (_req, _action, callback) =>
      callback({ admin, bizId }),
    );
  });

  test('lists plans through manager context and maps success response', async () => {
    (listVisitPackagePlans as jest.Mock).mockResolvedValue({
      ok: true,
      data: { plans: [{ id: 'plan-1' }] },
    });

    const response = await runListVisitPackagePlansHttp(req);
    const body = await response.json();

    expect(withManagerContext).toHaveBeenCalledWith(req, 'VisitPackagePlansList', expect.any(Function));
    expect(listVisitPackagePlans).toHaveBeenCalledWith({ admin, bizId });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ plans: [{ id: 'plan-1' }] });
  });

  test('validates POST body before creating a plan', async () => {
    (validateRequest as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        name_ru: 'Пакет',
        visit_count: 5,
        validity_days: 90,
        discount_type: 'percent',
        discount_value: 10,
      },
    });
    (createVisitPackagePlan as jest.Mock).mockResolvedValue({
      ok: true,
      data: { plan: { id: 'plan-1' } },
    });

    const response = await runCreateVisitPackagePlanHttp(req);
    const body = await response.json();

    expect(validateRequest).toHaveBeenCalled();
    expect(createVisitPackagePlan).toHaveBeenCalledWith({
      admin,
      bizId,
      body: {
        name_ru: 'Пакет',
        visit_count: 5,
        validity_days: 90,
        discount_type: 'percent',
        discount_value: 10,
      },
    });
    expect(response.status).toBe(200);
    expect(body.data).toEqual({ plan: { id: 'plan-1' } });
  });

  test('returns validation response for invalid POST body', async () => {
    const validationResponse = new Response(JSON.stringify({ error: 'bad' }), { status: 400 });
    (validateRequest as jest.Mock).mockResolvedValue({
      success: false,
      response: validationResponse,
    });

    const response = await runCreateVisitPackagePlanHttp(req);

    expect(response).toBe(validationResponse);
    expect(createVisitPackagePlan).not.toHaveBeenCalled();
  });
});
