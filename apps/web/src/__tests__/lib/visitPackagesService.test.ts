jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn() }));

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
      .mockReturnValueOnce(businessTimeZone())
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

  // API-11: a retried sale must not sell twice, and terms follow the business calendar.
  const activePlan = { id: planId, biz_id: bizId, visit_count: 5, validity_days: 30, is_active: true };
  const soldRow = {
    id: 'pkg-1',
    client_id: clientId,
    plan_id: planId,
    remaining_visits: 5,
    valid_until: '2026-04-26',
    purchased_at: '2026-03-26T19:30:00.000Z',
    created_at: '2026-03-26T19:30:00.000Z',
  };
  const planLookup = () => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: activePlan, error: null }),
  });
  const insertReturning = (data: unknown, error: unknown = null) => {
    const insert = jest.fn().mockReturnThis();
    return { insert, select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data, error }) };
  };
  const byRequestId = (data: unknown) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
  });

  test('the term starts on the business date: 01:30 in Bishkek is already the next day', async () => {
    const admin = createAdmin();
    const insert = insertReturning(soldRow);
    admin.from.mockReturnValueOnce(planLookup()).mockReturnValueOnce(businessTimeZone()).mockReturnValueOnce(insert);

    await sellVisitPackage({ admin, bizId, clientId, body: { plan_id: planId }, requestId: 'req-1', now: new Date('2026-03-26T19:30:00.000Z') });

    // UTC says 2026-03-26 (+30 = 04-25); the business is on 2026-03-27 (+30 = 04-26).
    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ valid_until: '2026-04-26', request_id: 'req-1' }));
  });

  test('the same sale request again returns the package it sold instead of selling another', async () => {
    const admin = createAdmin();
    admin.from
      .mockReturnValueOnce(planLookup())
      .mockReturnValueOnce(businessTimeZone())
      .mockReturnValueOnce(insertReturning(null, { code: '23505', message: 'duplicate key value violates unique constraint' }))
      .mockReturnValueOnce(byRequestId(soldRow));

    const result = await sellVisitPackage({ admin, bizId, clientId, body: { plan_id: planId }, requestId: 'req-1', now: new Date('2026-03-26T19:30:00.000Z') });

    expect(result).toEqual({ ok: true, data: { replayed: true, package: soldRow } });
  });

  test('a request key reused for another client or plan is a conflict', async () => {
    const admin = createAdmin();
    admin.from
      .mockReturnValueOnce(planLookup())
      .mockReturnValueOnce(businessTimeZone())
      .mockReturnValueOnce(insertReturning(null, { code: '23505', message: 'duplicate' }))
      .mockReturnValueOnce(byRequestId({ ...soldRow, client_id: 'someone-else' }));

    const result = await sellVisitPackage({ admin, bizId, clientId, body: { plan_id: planId }, requestId: 'req-1' });

    expect(result).toMatchObject({ ok: false, error: 'conflict', status: 409 });
  });

  test('a failed insert is a 500 without database text, and is logged', async () => {
    const { logError } = jest.requireMock('@/lib/log');
    const admin = createAdmin();
    admin.from
      .mockReturnValueOnce(planLookup())
      .mockReturnValueOnce(businessTimeZone())
      .mockReturnValueOnce(insertReturning(null, { code: '42P01', message: 'relation secret_table does not exist' }));

    const result = await sellVisitPackage({ admin, bizId, clientId, body: { plan_id: planId } });

    expect(result).toEqual({ ok: false, error: 'server', message: 'Не удалось оформить пакет', status: 500 });
    expect(logError).toHaveBeenCalledWith('VisitPackages', 'Visit package sale failed', expect.objectContaining({ code: '42P01' }));
  });

  test('without a stored time zone the platform default (Asia/Bishkek) is used', async () => {
    const admin = createAdmin();
    const insert = insertReturning(soldRow);
    admin.from.mockReturnValueOnce(planLookup()).mockReturnValueOnce(businessTimeZone(null)).mockReturnValueOnce(insert);

    await sellVisitPackage({ admin, bizId, clientId, body: { plan_id: planId }, now: new Date('2026-03-26T19:30:00.000Z') });

    expect(insert.insert).toHaveBeenCalledWith(expect.objectContaining({ valid_until: '2026-04-26' }));
    expect(insert.insert.mock.calls[0][0]).not.toHaveProperty('request_id');
  });
});

function businessTimeZone(tz: string | null = 'Asia/Bishkek') {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { tz }, error: null }),
  };
}
