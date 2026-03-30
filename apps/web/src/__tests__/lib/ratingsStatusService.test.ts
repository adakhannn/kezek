import { getRatingsStatus, type RatingsStatusAdminQueryLike } from '@/lib/ratingsStatusService';

describe('ratingsStatusService', () => {
  function createMetricMaxQuery(metricDate: string | null) {
    return {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: metricDate ? { metric_date: metricDate } : null,
        error: null,
      }),
    };
  }

  function createLastRatingQuery(value: string | null) {
    return {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: value ? { last_rating_recalculated_at: value } : null,
        error: null,
      }),
    };
  }

  function createNullRatingCountQuery(count: number) {
    return {
      select: jest.fn().mockReturnThis(),
      is: jest.fn().mockResolvedValue({
        count,
        error: null,
      }),
    };
  }

  function createRecentErrorsQuery(rows: Array<{ entity_type: string }>) {
    return {
      select: jest.fn().mockReturnThis(),
      gte: jest.fn().mockResolvedValue({
        data: rows,
        error: null,
      }),
    };
  }

  test('builds ratings health summary', async () => {
    const admin: jest.Mocked<RatingsStatusAdminQueryLike> = {
      from: jest
        .fn()
        .mockReturnValueOnce(createMetricMaxQuery('2024-01-15'))
        .mockReturnValueOnce(createMetricMaxQuery('2024-01-14'))
        .mockReturnValueOnce(createMetricMaxQuery('2024-01-13'))
        .mockReturnValueOnce(createLastRatingQuery('2024-01-15T00:00:00.000Z'))
        .mockReturnValueOnce(createLastRatingQuery('2024-01-14T00:00:00.000Z'))
        .mockReturnValueOnce(createLastRatingQuery('2024-01-13T00:00:00.000Z'))
        .mockReturnValueOnce(createNullRatingCountQuery(5))
        .mockReturnValueOnce(createNullRatingCountQuery(3))
        .mockReturnValueOnce(createNullRatingCountQuery(2))
        .mockReturnValueOnce(
          createRecentErrorsQuery([
            { entity_type: 'staff' },
            { entity_type: 'staff' },
            { entity_type: 'branch' },
          ]),
        ),
    };

    const result = await getRatingsStatus(admin, { errorsWindowDaysParam: '3' });

    expect(result).toEqual({
      staff_last_metric_date: '2024-01-15',
      branch_last_metric_date: '2024-01-14',
      biz_last_metric_date: '2024-01-13',
      staff_last_rating_recalculated_at: '2024-01-15T00:00:00.000Z',
      branch_last_rating_recalculated_at: '2024-01-14T00:00:00.000Z',
      biz_last_rating_recalculated_at: '2024-01-13T00:00:00.000Z',
      staff_without_rating: 5,
      branches_without_rating: 3,
      businesses_without_rating: 2,
      recent_errors_total: 3,
      recent_errors_by_type: { staff: 2, branch: 1 },
      recent_errors_days: 3,
      has_recent_errors: true,
    });
  });

  test('falls back to zero recent errors when table is unavailable', async () => {
    const admin: jest.Mocked<RatingsStatusAdminQueryLike> = {
      from: jest
        .fn()
        .mockReturnValueOnce(createMetricMaxQuery(null))
        .mockReturnValueOnce(createMetricMaxQuery(null))
        .mockReturnValueOnce(createMetricMaxQuery(null))
        .mockReturnValueOnce(createLastRatingQuery(null))
        .mockReturnValueOnce(createLastRatingQuery(null))
        .mockReturnValueOnce(createLastRatingQuery(null))
        .mockReturnValueOnce(createNullRatingCountQuery(0))
        .mockReturnValueOnce(createNullRatingCountQuery(0))
        .mockReturnValueOnce(createNullRatingCountQuery(0))
        .mockImplementationOnce(() => {
          throw new Error('missing table');
        }),
    };

    const result = await getRatingsStatus(admin);

    expect(result.recent_errors_total).toBe(0);
    expect(result.recent_errors_by_type).toEqual({});
    expect(result.has_recent_errors).toBe(false);
    expect(result.recent_errors_days).toBe(7);
  });
});
