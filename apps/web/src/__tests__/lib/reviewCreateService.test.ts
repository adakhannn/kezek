import {
  createOrUpdateReview,
  type ReviewCreateSupabaseLike,
} from '@/lib/reviewCreateService';

describe('reviewCreateService', () => {
  function createSupabase() {
    return {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    } as unknown as jest.Mocked<ReviewCreateSupabaseLike>;
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
            data: { id: 'booking-id', client_id: 'user-id', status: 'completed' },
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

  test('updates existing review for same client', async () => {
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
            data: { id: 'booking-id', client_id: 'user-id', status: 'completed' },
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
      now: new Date('2026-03-27T10:00:00.000Z'),
    });

    expect(result).toEqual({
      ok: true,
      data: { id: 'review-id', updated: true },
    });
  });
});
