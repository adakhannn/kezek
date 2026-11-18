import {
  createOrUpdateReview,
  isValidReviewRating,
  REVIEW_AFTER_VISIT_MESSAGE,
  type ReviewCreateSupabaseLike,
} from '@/lib/reviewCreateService';

describe('reviewCreateService', () => {
  const NOW = new Date('2026-03-27T10:00:00.000Z');
  const PAID_VISIT = { id: 'booking-id', client_id: 'user-id', status: 'paid', start_at: '2026-03-20T10:00:00.000Z' };

  function createSupabase() {
    return {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    } as unknown as jest.Mocked<ReviewCreateSupabaseLike>;
  }

  /** bookings returns `booking`; reviews has no review yet; the insert answers `insertResult`. */
  function setupCreate(
    booking: Record<string, unknown>,
    insertResult: { data: { id: string } | null; error: { message: string; code?: string } | null },
  ) {
    const supabase = createSupabase();
    const insert = jest.fn().mockReturnThis();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-id' } } });
    supabase.from.mockImplementation((table: string) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: booking, error: null }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert,
        single: jest.fn().mockResolvedValue(insertResult),
      };
    });
    return { supabase, insert };
  }

  test('validates missing required fields', async () => {
    const supabase = createSupabase();

    const result = await createOrUpdateReview({
      supabase,
      body: {},
    });

    expect(result).toEqual({
      ok: false,
      error: 'validation',
      message: 'booking_id и rating обязательны',
      status: 400,
    });
  });

  test.each([0, 6, 4.5, Number.NaN])('rejects rating %p before any query', async (rating) => {
    const supabase = createSupabase();

    const result = await createOrUpdateReview({ supabase, body: { booking_id: 'booking-id', rating } });

    expect(result).toMatchObject({ ok: false, error: 'validation', status: 400 });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('accepts whole ratings from 1 to 5 only', () => {
    expect([1, 2, 3, 4, 5].every(isValidReviewRating)).toBe(true);
    expect([0, 6, 2.5, '5', null].some(isValidReviewRating)).toBe(false);
  });

  test('creates a review for an own paid visit that has started; the author is set by the database', async () => {
    const { supabase, insert } = setupCreate(PAID_VISIT, { data: { id: 'review-id' }, error: null });

    const result = await createOrUpdateReview({
      supabase,
      body: { booking_id: 'booking-id', rating: 5, comment: 'Спасибо' },
      now: NOW,
    });

    expect(result).toEqual({ ok: true, data: { id: 'review-id', updated: false } });
    expect(insert).toHaveBeenCalledWith({ booking_id: 'booking-id', rating: 5, comment: 'Спасибо' });
  });

  test.each([
    ['a confirmed visit', { ...PAID_VISIT, status: 'confirmed' }],
    ['a cancelled visit', { ...PAID_VISIT, status: 'cancelled' }],
    ['a no-show', { ...PAID_VISIT, status: 'no_show' }],
    ['a paid visit that has not started', { ...PAID_VISIT, start_at: '2026-03-28T10:00:00.000Z' }],
    ['a visit without a start', { ...PAID_VISIT, start_at: null }],
  ])('refuses a new review for %s (DB-13)', async (_label, booking) => {
    const { supabase, insert } = setupCreate(booking, { data: null, error: null });

    const result = await createOrUpdateReview({ supabase, body: { booking_id: 'booking-id', rating: 5 }, now: NOW });

    expect(result).toEqual({ ok: false, error: 'forbidden', message: REVIEW_AFTER_VISIT_MESSAGE, status: 403 });
    expect(insert).not.toHaveBeenCalled();
  });

  test('a duplicate insert (race of two submits) answers 409', async () => {
    const { supabase } = setupCreate(PAID_VISIT, {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "reviews_booking_id_key"' },
    });

    const result = await createOrUpdateReview({ supabase, body: { booking_id: 'booking-id', rating: 5 }, now: NOW });

    expect(result).toEqual({ ok: false, error: 'conflict', message: 'Отзыв уже существует', status: 409 });
  });

  test('a refusal by the database policy answers 403', async () => {
    const { supabase } = setupCreate(PAID_VISIT, {
      data: null,
      error: { code: '42501', message: 'new row violates row-level security policy for table "reviews"' },
    });

    const result = await createOrUpdateReview({ supabase, body: { booking_id: 'booking-id', rating: 5 }, now: NOW });

    expect(result).toEqual({ ok: false, error: 'forbidden', message: REVIEW_AFTER_VISIT_MESSAGE, status: 403 });
  });

  test('returns conflict when another client already has review', async () => {
    const supabase = createSupabase();
    let reviewsCall = 0;
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    supabase.from.mockImplementation((table: string) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: PAID_VISIT,
            error: null,
          }),
        };
      }

      if (table === 'reviews' && reviewsCall === 0) {
        reviewsCall += 1;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'review-id', client_id: 'other-user-id' },
            error: null,
          }),
        };
      }

      return {} as never;
    });

    const result = await createOrUpdateReview({
      supabase,
      body: { booking_id: 'booking-id', rating: 5 },
    });

    expect(result).toEqual({
      ok: false,
      error: 'conflict',
      message: 'Отзыв уже существует',
      status: 409,
    });
  });

  test('the author updates an existing review at any time, also after the booking status changed', async () => {
    const supabase = createSupabase();
    let reviewsCall = 0;
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-id' } },
    });
    supabase.from.mockImplementation((table: string) => {
      if (table === 'bookings') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { ...PAID_VISIT, status: 'no_show' },
            error: null,
          }),
        };
      }

      if (table === 'reviews' && reviewsCall === 0) {
        reviewsCall += 1;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: 'review-id', client_id: 'user-id' },
            error: null,
          }),
        };
      }

      return {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'review-id' },
          error: null,
        }),
      };
    });

    const result = await createOrUpdateReview({
      supabase,
      body: { booking_id: 'booking-id', rating: 4, comment: 'Updated comment' },
      now: NOW,
    });

    expect(result).toEqual({
      ok: true,
      data: { id: 'review-id', updated: true },
    });
  });
});
