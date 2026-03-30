import {
  getBranchSchedule,
  saveBranchSchedule,
  type BranchScheduleAdminLike,
} from '@/lib/branchScheduleService';

describe('branchScheduleService', () => {
  const branchId = 'branch-uuid';
  const bizId = 'biz-uuid';

  function createAdmin() {
    return {
      from: jest.fn(),
    } as unknown as jest.Mocked<BranchScheduleAdminLike>;
  }

  function createBranchLookupQuery(result: { data: unknown; error: unknown }) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue(result),
    };
  }

  function createDeleteQuery(result: { data: unknown; error: unknown }) {
    const query = {
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn(),
    };

    let eqCalls = 0;
    query.eq.mockImplementation(() => {
      eqCalls += 1;
      return eqCalls >= 2 ? Promise.resolve(result) : query;
    });

    return query;
  }

  function createInsertQuery(result: { error: unknown }) {
    return {
      insert: jest.fn().mockResolvedValue(result),
    };
  }

  function createScheduleSelectQuery(result: { data: unknown; error: unknown }) {
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue(result),
    };
  }

  test('returns not_found when branch is missing', async () => {
    const admin = createAdmin();
    admin.from.mockReturnValueOnce(
      createBranchLookupQuery({
        data: null,
        error: null,
      }),
    );

    const result = await getBranchSchedule({ admin, branchId, bizId });

    expect(result).toEqual({
      ok: false,
      error: 'not_found',
      message: 'Филиал не найден',
      status: 404,
    });
  });

  test('loads schedule successfully', async () => {
    const admin = createAdmin();
    admin.from
      .mockReturnValueOnce(
        createBranchLookupQuery({
          data: { id: branchId, biz_id: bizId },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        createScheduleSelectQuery({
          data: [
            {
              day_of_week: 1,
              intervals: [{ start: '09:00', end: '18:00' }],
              breaks: [],
            },
          ],
          error: null,
        }),
      );

    const result = await getBranchSchedule({ admin, branchId, bizId });

    expect(result).toEqual({
      ok: true,
      data: {
        schedule: [
          {
            day_of_week: 1,
            intervals: [{ start: '09:00', end: '18:00' }],
            breaks: [],
          },
        ],
      },
    });
  });

  test('validates schedule array before save', async () => {
    const admin = createAdmin();
    admin.from.mockReturnValueOnce(
      createBranchLookupQuery({
        data: { id: branchId, biz_id: bizId },
        error: null,
      }),
    );

    const result = await saveBranchSchedule({
      admin,
      branchId,
      bizId,
      body: { schedule: 'not-an-array' as never },
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'schedule должен быть массивом',
      status: 400,
    });
  });

  test('saves schedule successfully', async () => {
    const admin = createAdmin();
    admin.from
      .mockReturnValueOnce(
        createBranchLookupQuery({
          data: { id: branchId, biz_id: bizId },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        createDeleteQuery({
          data: null,
          error: null,
        }),
      )
      .mockReturnValueOnce(
        createInsertQuery({
          error: null,
        }),
      );

    const result = await saveBranchSchedule({
      admin,
      branchId,
      bizId,
      body: {
        schedule: [
          {
            day_of_week: 1,
            intervals: [{ start: '09:00', end: '18:00' }],
            breaks: [],
          },
        ],
      },
    });

    expect(result).toEqual({
      ok: true,
      data: {},
    });
  });
});
