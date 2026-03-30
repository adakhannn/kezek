import { initializeRatings, type InitializeRatingsAdminLike } from '@/lib/initializeRatingsService';

describe('initializeRatingsService', () => {
  let admin: jest.Mocked<InitializeRatingsAdminLike>;

  beforeEach(() => {
    admin = {
      rpc: jest.fn(),
    };
  });

  test('updates aggregated ratings in finalize mode', async () => {
    admin.rpc.mockResolvedValue({ error: null });

    const result = await initializeRatings(admin, { finalize_only: true });

    expect(result).toEqual({
      ok: true,
      data: { message: 'Aggregated ratings updated' },
    });
    expect(admin.rpc).toHaveBeenCalledWith('update_all_aggregated_ratings', {});
  });

  test('rejects too large date range', async () => {
    const result = await initializeRatings(admin, {
      start_date: '2026-01-01',
      end_date: '2026-02-05',
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'validation',
      message:
        'Диапазон дат не должен превышать 31 дней (указано 36). Вызывайте батчами.',
    });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  test('recalculates metrics for date range', async () => {
    admin.rpc.mockResolvedValue({ error: null });

    const result = await initializeRatings(admin, {
      start_date: '2026-01-01',
      end_date: '2026-01-03',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        message:
          'Metrics recalculated from 2026-01-01 to 2026-01-03. Вызовите с finalize_only: true для обновления рейтингов.',
      },
    });
    expect(admin.rpc).toHaveBeenCalledWith('recalculate_ratings_for_date_range', {
      p_start_date: '2026-01-01',
      p_end_date: '2026-01-03',
    });
  });

  test('rejects invalid days_back range', async () => {
    const result = await initializeRatings(admin, { days_back: 500 });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'validation',
      message: 'days_back должен быть от 1 до 365',
    });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  test('initializes ratings with default days_back', async () => {
    admin.rpc.mockResolvedValue({ error: null });

    const result = await initializeRatings(admin, {});

    expect(result).toEqual({
      ok: true,
      data: { message: 'Ratings initialized for last 30 days' },
    });
    expect(admin.rpc).toHaveBeenCalledWith('initialize_all_ratings', {
      p_days_back: 30,
    });
  });
});
