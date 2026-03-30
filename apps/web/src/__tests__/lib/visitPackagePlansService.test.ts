import {
  createVisitPackagePlan,
  listVisitPackagePlans,
  updateVisitPackagePlan,
  type VisitPackagePlansAdminLike,
} from '@/lib/visitPackagePlansService';

describe('visitPackagePlansService', () => {
  const bizId = 'biz-uuid';
  const planId = 'plan-uuid';

  function createAdmin() {
    return {
      from: jest.fn(),
    } as unknown as jest.Mocked<VisitPackagePlansAdminLike>;
  }

  test('lists mapped visit package plans', async () => {
    const admin = createAdmin();
    admin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          {
            id: planId,
            biz_id: bizId,
            name_ru: 'Пакет 5 визитов',
            name_ky: null,
            name_en: null,
            visit_count: 5,
            validity_days: 90,
            discount_type: 'percent',
            discount_value: '20',
            service_id: null,
            branch_ids: null,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
        error: null,
      }),
    });

    const result = await listVisitPackagePlans({ admin, bizId });

    expect(result).toEqual({
      ok: true,
      data: {
        plans: [
          {
            id: planId,
            biz_id: bizId,
            name_ru: 'Пакет 5 визитов',
            name_ky: null,
            name_en: null,
            visit_count: 5,
            validity_days: 90,
            discount_type: 'percent',
            discount_value: 20,
            service_id: null,
            branch_ids: null,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
      },
    });
  });

  test('creates visit package plan', async () => {
    const admin = createAdmin();
    admin.from.mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: planId,
          name_ru: 'Пакет 10 визитов',
          visit_count: 10,
          validity_days: 180,
          discount_type: 'fixed_price',
          discount_value: '5000',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
        error: null,
      }),
    });

    const result = await createVisitPackagePlan({
      admin,
      bizId,
      body: {
        name_ru: 'Пакет 10 визитов',
        visit_count: 10,
        validity_days: 180,
        discount_type: 'fixed_price',
        discount_value: 5000,
      },
    });

    expect(result).toEqual({
      ok: true,
      data: {
        plan: {
          id: planId,
          name_ru: 'Пакет 10 визитов',
          visit_count: 10,
          validity_days: 180,
          discount_type: 'fixed_price',
          discount_value: 5000,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
        },
      },
    });
  });

  test('returns updated false for empty patch body', async () => {
    const admin = createAdmin();
    admin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: planId, biz_id: bizId },
        error: null,
      }),
    });

    const result = await updateVisitPackagePlan({
      admin,
      planId,
      bizId,
      body: {},
    });

    expect(result).toEqual({
      ok: true,
      data: {
        plan_id: planId,
        updated: false,
      },
    });
  });

  test('returns not_found when patch target belongs to another business', async () => {
    const admin = createAdmin();
    admin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: planId, biz_id: 'other-biz' },
        error: null,
      }),
    });

    const result = await updateVisitPackagePlan({
      admin,
      planId,
      bizId,
      body: { name_ru: 'Новое имя' },
    });

    expect(result).toEqual({
      ok: false,
      error: 'not_found',
      message: 'План пакета не найден или доступ запрещён',
      status: 404,
    });
  });
});
