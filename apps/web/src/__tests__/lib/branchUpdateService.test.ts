import { updateBranch, type BranchUpdateAdminLike } from '@/lib/branchUpdateService';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { validateLatLon } from '@/lib/validation';

jest.mock('@/lib/dbHelpers', () => ({
  checkResourceBelongsToBiz: jest.fn(),
}));

jest.mock('@/lib/validation', () => ({
  validateLatLon: jest.fn(),
  coordsToEWKT: jest.fn((lat, lon) => `POINT(${lon} ${lat})`),
}));

describe('branchUpdateService', () => {
  const branchId = 'branch-uuid';
  const bizId = 'biz-uuid';

  function createAdmin() {
    return {
      from: jest.fn(),
    } as unknown as jest.Mocked<BranchUpdateAdminLike>;
  }

  function createUpdateQuery(result: { error: unknown }) {
    const query = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn(),
    };

    let eqCalls = 0;
    query.eq.mockImplementation(() => {
      eqCalls += 1;
      return eqCalls >= 2 ? Promise.resolve(result) : query;
    });

    return query;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (checkResourceBelongsToBiz as jest.Mock).mockReset();
  });

  test('rejects invalid coordinates', async () => {
    const admin = createAdmin();
    (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
      data: { id: branchId, biz_id: bizId },
      error: null,
    });
    (validateLatLon as jest.Mock).mockReturnValue({
      ok: false,
      error: 'Invalid coordinates',
    });

    const result = await updateBranch({
      admin,
      branchId,
      bizId,
      body: {
        name: 'Test Branch',
        is_active: true,
        lat: 200,
        lon: 200,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: expect.any(String),
      status: 400,
    });
  });

  test('rejects branch from another business', async () => {
    const admin = createAdmin();
    (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: 'Resource belongs to different business',
    });

    const result = await updateBranch({
      admin,
      branchId,
      bizId,
      body: {
        name: 'Test Branch',
        is_active: true,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'forbidden',
      message: 'Филиал не принадлежит этому бизнесу',
      details: { currentBizId: bizId },
      status: 403,
    });
  });

  test('updates branch successfully', async () => {
    const admin = createAdmin();
    (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
      data: { id: branchId, biz_id: bizId },
      error: null,
    });
    admin.from.mockReturnValueOnce(
      createUpdateQuery({
        error: null,
      }),
    );

    const result = await updateBranch({
      admin,
      branchId,
      bizId,
      body: {
        name: ' Updated Branch ',
        address: 'Address',
        is_active: true,
      },
    });

    expect(result).toEqual({
      ok: true,
      data: {},
    });
  });

  test('preserves omitted fields when updating one contact', async () => {
    const admin = createAdmin();
    (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({ data: { id: branchId, biz_id: bizId }, error: null });
    const query = createUpdateQuery({ error: null });
    admin.from.mockReturnValueOnce(query);
    const result = await updateBranch({ admin, branchId, bizId, body: { contact_email: ' OWNER@EXAMPLE.COM ' } });
    expect(result.ok).toBe(true);
    expect(query.update).toHaveBeenCalledWith({ contact_email: 'owner@example.com' });
  });

  test.each([{ lat: 42 }, { lon: 74 }, { lat: null, lon: 74 }, { lat: 42, lon: null }])(
    'rejects incomplete coordinates without database writes: %j', async (body) => {
      const admin = createAdmin();
      expect(await updateBranch({ admin, branchId, bizId, body })).toMatchObject({ ok: false, status: 400 });
      expect(admin.from).not.toHaveBeenCalled();
    },
  );
});
