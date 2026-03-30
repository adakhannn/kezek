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
  from: (table: string) => {
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

  const { data: booking, error: bookingError } = await (params.supabase.from('bookings') as {
    select: (...args: unknown[]) => {
      eq: (...args: unknown[]) => {
        maybeSingle: () => Promise<{
          data: { id: string; client_id: string; status: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select('id, client_id, status')
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
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select('id, client_id')
    .eq('booking_id', params.body.booking_id)
    .maybeSingle();

  if (existingReview) {
    if (existingReview.client_id === userId) {
      const { error, data } = await ((params.supabase.from('reviews') as {
        update: (...args: unknown[]) => {
          eq: (...args: unknown[]) => {
            select: (...args: unknown[]) => {
              single: () => Promise<{
                data: { id: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      })
        .update({
          rating: params.body.rating,
          comment: params.body.comment ?? null,
          updated_at: (params.now ?? new Date()).toISOString(),
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

  const { error, data } = await ((params.supabase.from('reviews') as {
    insert: (...args: unknown[]) => {
      select: (...args: unknown[]) => {
        single: () => Promise<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .insert({
      booking_id: params.body.booking_id,
      client_id: userId,
      rating: params.body.rating,
      comment: params.body.comment ?? null,
    })
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
    data: { id: data?.id, updated: false },
  };
}
