import {
  createServiceRouteEntry,
  type ServiceCreateAdminLike,
} from '@/lib/serviceCreateRouteService';

describe('serviceCreateRouteService', () => {
  function createAdmin() {
    return {
      from: jest.fn(),
    } as unknown as jest.Mocked<ServiceCreateAdminLike>;
  }

  function createBranchesQuery(branchIds: string[]) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: branchIds.map((id) => ({ id })),
        error: null,
      }),
    };
  }

  function createServicesInsertQuery(inserted: Array<{ id: string; branch_id: string }>) {
    return {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue({
        data: inserted,
        error: null,
      }),
    };
  }

  test('rejects empty branch selection', async () => {
    const admin = createAdmin();

    const result = await createServiceRouteEntry({
      admin,
      bizId: 'biz-id',
      body: {
        name_ru: 'Test Service',
        duration_min: 60,
        price_from: 1000,
        price_to: 1500,
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'Необходимо указать хотя бы один филиал',
      status: 400,
    });
  });

  test('rejects branches outside business ownership', async () => {
    const admin = createAdmin();
    admin.from.mockReturnValueOnce(createBranchesQuery(['branch-id-1']));

    const result = await createServiceRouteEntry({
      admin,
      bizId: 'biz-id',
      body: {
        name_ru: 'Test Service',
        duration_min: 60,
        price_from: 1000,
        price_to: 1500,
        branch_ids: ['branch-id-1', 'branch-id-2'],
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'Некоторые филиалы не принадлежат этому бизнесу',
      details: { missing: ['branch-id-2'] },
      status: 400,
    });
  });

  test('creates services for all resolved branch ids', async () => {
    const admin = createAdmin();
    admin.from
      .mockReturnValueOnce(createBranchesQuery(['branch-id-1', 'branch-id-2']))
      .mockReturnValueOnce(
        createServicesInsertQuery([
          { id: 'service-id-1', branch_id: 'branch-id-1' },
          { id: 'service-id-2', branch_id: 'branch-id-2' },
        ]),
      );

    const result = await createServiceRouteEntry({
      admin,
      bizId: 'biz-id',
      body: {
        name_ru: ' Test Service ',
        name_en: 'Test Service EN',
        name_ky: 'Test Service KY',
        duration_min: 60,
        price_from: 1000,
        price_to: 1500,
        branch_ids: ['branch-id-1', 'branch-id-2', 'branch-id-1'],
      },
    });

    expect(result).toEqual({
      ok: true,
      data: {
        count: 2,
        ids: ['service-id-1', 'service-id-2'],
      },
    });
  });
});
