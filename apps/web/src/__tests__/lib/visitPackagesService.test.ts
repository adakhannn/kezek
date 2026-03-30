import {
  listVisitPackages,
  sellVisitPackage,
  type VisitPackagesAdminLike,
} from '@/lib/visitPackagesService';

describe('visitPackagesService', () => {
  const bizId = 'biz-uuid';
  const clientId = 'client-uuid';
  const planId = 'plan-uuid';

  function createAdmin() {
    return {
      from: jest.fn(),
    } as unknown as jest.Mocked<VisitPackagesAdminLike>;
  }

  test('returns empty list when business has no plans', async () => {
    const admin = createAdmin();
    admin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    const result = await listVisitPackages({
      admin,
      bizId,
      query: {},
      today: '2026-03-27',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        packages: [],
      },
    });
  });

  test('filters listed packages by branch id', async () => {
    const admin = createAdmin();
    admin.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [
            {
              id: planId,
              name_ru: 'Пакет',
              name_ky: null,
              name_en: null,
              visit_count: 5,
              branch_ids: ['branch-1'],
            },
          ],
          error: null,
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'pkg-1',
              client_id: clientId,
              plan_id: planId,
              remaining_visits: 2,
              valid_until: '2026-04-01',
              purchased_at: '2026-03-01T00:00:00Z',
              created_at: '2026-03-01T00:00:00Z',
            },
          ],
          error: null,
        }),
      })
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [{ id: clientId, full_name: 'Иван Иванов' }],
          error: null,
        }),
      });

    const result = await listVisitPackages({
      admin,
      bizId,
      query: { branchId: 'branch-1' },
      today: '2026-03-27',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        packages: [
          {
            id: 'pkg-1',
            client_id: clientId,
            client_name: 'Иван Иванов',
            plan_id: planId,
            remaining_visits: 2,
            valid_until: '2026-04-01',
            purchased_at: '2026-03-01T00:00:00Z',
            created_at: '2026-03-01T00:00:00Z',
            plan_name_ru: 'Пакет',
            plan_name_ky: null,
            plan_name_en: null,
            plan_visit_count: 5,
          },
        ],
      },
    });
  });

  test('rejects inactive plan on sale', async () => {
    const admin = createAdmin();
    admin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: planId,
          biz_id: bizId,
          visit_count: 5,
          validity_days: 90,
          is_active: false,
        },
        error: null,
      }),
    });

    const result = await sellVisitPackage({
      admin,
      bizId,
      clientId,
      body: { plan_id: planId },
      now: new Date('2026-03-27T10:00:00.000Z'),
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'План пакета деактивирован',
      status: 400,
    });
  });

  test('sells package with computed validity date', async () => {
    const admin = createAdmin();
    admin.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: {
            id: planId,
            biz_id: bizId,
            visit_count: 5,
            validity_days: 30,
            is_active: true,
          },
          error: null,
        }),
      })
      .mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'pkg-1',
            client_id: clientId,
            plan_id: planId,
            remaining_visits: 5,
            valid_until: '2026-04-26',
            purchased_at: '2026-03-27T10:00:00.000Z',
            created_at: '2026-03-27T10:00:00.000Z',
          },
          error: null,
        }),
      });

    const result = await sellVisitPackage({
      admin,
      bizId,
      clientId,
      body: { plan_id: planId },
      now: new Date('2026-03-27T10:00:00.000Z'),
    });

    expect(result).toEqual({
      ok: true,
      data: {
        package: {
          id: 'pkg-1',
          client_id: clientId,
          plan_id: planId,
          remaining_visits: 5,
          valid_until: '2026-04-26',
          purchased_at: '2026-03-27T10:00:00.000Z',
          created_at: '2026-03-27T10:00:00.000Z',
        },
      },
    });
  });
});
