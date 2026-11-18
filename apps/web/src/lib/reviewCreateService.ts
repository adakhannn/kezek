export type ReviewCreateBody = {
  booking_id?: string;
  rating?: number;
  comment?: string;
};

export type ReviewCreateSupabaseLike = {
  auth: {
    getUser: () => Promise<{
      data: {
        user: {
          id: string;
        } | null;
      };
    }>;
  };
  from(table: string): {
    select?: (...args: unknown[]) => unknown;
    update?: (...args: unknown[]) => unknown;
    insert?: (...args: unknown[]) => unknown;
  };
};

export type ReviewCreateResult =
  | { ok: true; data: { id: string | undefined; updated: boolean } }
  | {
      ok: false;
      error: 'auth' | 'validation' | 'not_found' | 'forbidden' | 'conflict';
      message: string;
      status: number;
    };

type DbError = { message: string; code?: string } | null;

/** Same rule as public.can_review (DB-13): an own booking with status paid whose visit has started. */
export const REVIEW_AFTER_VISIT_MESSAGE = 'Отзыв можно оставить только после визита';
export const REVIEW_RATING_MESSAGE = 'rating должен быть целым числом от 1 до 5';

/** reviews.rating is smallint with check (rating between 1 and 5). */
export function isValidReviewRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

export async function createOrUpdateReview(params: {
  supabase: ReviewCreateSupabaseLike;
  body: ReviewCreateBody;
  now?: Date;
}): Promise<ReviewCreateResult> {
  if (!params.body.booking_id || !params.body.rating) {
    return {
      ok: false,
      error: 'validation',
      message: 'booking_id и rating обязательны',
      status: 400,
    };
  }

  if (!isValidReviewRating(params.body.rating)) {
    return {
      ok: false,
      error: 'validation',
      message: REVIEW_RATING_MESSAGE,
      status: 400,
    };
  }

  const {
    data: { user },
  } = await params.supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      error: 'auth',
      message: 'Не авторизован',
      status: 401,
    };
  }

  const userId = user.id;
  const now = params.now ?? new Date();

  const { data: booking, error: bookingError } = await (params.supabase.from('bookings') as {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        maybeSingle: () => Promise<{
          data: { id: string; client_id: string; status: string; start_at: string | null } | null;
          error: DbError;
        }>;
      };
    };
  })
    .select('id, client_id, status, start_at')
    .eq('id', params.body.booking_id)
    .maybeSingle();

  if (bookingError || !booking) {
    return {
      ok: false,
      error: 'not_found',
      message: 'Бронирование не найдено',
      status: 404,
    };
  }

  if (booking.client_id !== userId) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Доступ запрещен',
      status: 403,
    };
  }

  const { data: existingReview } = await (params.supabase.from('reviews') as {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        maybeSingle: () => Promise<{
          data: { id: string; client_id: string } | null;
          error: DbError;
        }>;
      };
    };
  })
    .select('id, client_id')
    .eq('booking_id', params.body.booking_id)
    .maybeSingle();

  if (existingReview) {
    if (existingReview.client_id === userId) {
      // The author edits rating and comment at any time (public.can_edit_review).
      const { error, data } = await ((params.supabase.from('reviews') as {
        update: (...args: unknown[]) => {
          eq: (...args: unknown[]) => {
            select: (...args: unknown[]) => {
              single: () => Promise<{
                data: { id: string } | null;
                error: DbError;
              }>;
            };
          };
        };
      })
        .update({
          rating: params.body.rating,
          comment: params.body.comment ?? null,
          updated_at: now.toISOString(),
        })
        .eq('id', existingReview.id)
        .select('id')
        .single());

      if (error) {
        return {
          ok: false,
          error: 'validation',
          message: error.message,
          status: 400,
        };
      }

      return {
        ok: true,
        data: { id: data?.id, updated: true },
      };
    }

    return {
      ok: false,
      error: 'conflict',
      message: 'Отзыв уже существует',
      status: 409,
    };
  }

  const startAt = booking.start_at ? new Date(booking.start_at).getTime() : Number.NaN;
  if (booking.status !== 'paid' || !(startAt <= now.getTime())) {
    return {
      ok: false,
      error: 'forbidden',
      message: REVIEW_AFTER_VISIT_MESSAGE,
      status: 403,
    };
  }

  // client_id and created_at are set by the database (reviews_set_client_id).
  const { error, data } = await ((params.supabase.from('reviews') as {
    insert: (...args: unknown[]) => {
      select: (...args: unknown[]) => {
        single: () => Promise<{
          data: { id: string } | null;
          error: DbError;
        }>;
      };
    };
  })
    .insert({
      booking_id: params.body.booking_id,
      rating: params.body.rating,
      comment: params.body.comment ?? null,
    })
    .select('id')
    .single());

  if (error?.code === '23505') {
    return {
      ok: false,
      error: 'conflict',
      message: 'Отзыв уже существует',
      status: 409,
    };
  }

  if (error?.code === '42501') {
    return {
      ok: false,
      error: 'forbidden',
      message: REVIEW_AFTER_VISIT_MESSAGE,
      status: 403,
    };
  }

  if (error) {
    return {
      ok: false,
      error: 'validation',
      message: error.message,
      status: 400,
    };
  }

  return {
    ok: true,
    data: { id: data?.id, updated: false },
  };
}
