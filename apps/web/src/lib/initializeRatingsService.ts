import { logDebug, logError } from '@/lib/log';

const DAYS_BACK_MIN = 1;
const DAYS_BACK_MAX = 365;
const DATE_RANGE_CHUNK_DAYS_MAX = 31;
const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type RpcResult = {
  error: { message: string } | null;
};

export type InitializeRatingsAdminLike = {
  rpc: (
    fn: string,
    params: Record<string, unknown>,
  ) => Promise<RpcResult>;
};

export type InitializeRatingsPayload = {
  days_back?: number;
  start_date?: string;
  end_date?: string;
  finalize_only?: boolean;
};

export type InitializeRatingsResult =
  | { ok: true; data: { message: string } }
  | { ok: false; status: number; error: string; message: string };

export async function initializeRatings(
  admin: InitializeRatingsAdminLike,
  body: InitializeRatingsPayload,
): Promise<InitializeRatingsResult> {
  if (body.finalize_only === true) {
    const { error } = await admin.rpc('update_all_aggregated_ratings', {});
    if (error) {
      logError('InitializeRatings', 'Error updating aggregated ratings', error);
      return {
        ok: false,
        status: 500,
        error: 'internal',
        message: error.message,
      };
    }

    logDebug('InitializeRatings', 'Aggregated ratings updated');
    return {
      ok: true,
      data: { message: 'Aggregated ratings updated' },
    };
  }

  const startStr =
    typeof body.start_date === 'string' && YMD_REGEX.test(body.start_date)
      ? body.start_date
      : null;
  const endStr =
    typeof body.end_date === 'string' && YMD_REGEX.test(body.end_date)
      ? body.end_date
      : null;

  if (startStr !== null && endStr !== null) {
    if (startStr > endStr) {
      return {
        ok: false,
        status: 400,
        error: 'validation',
        message: 'start_date не должен быть больше end_date',
      };
    }

    const startDate = new Date(`${startStr}T12:00:00Z`);
    const endDate = new Date(`${endStr}T12:00:00Z`);
    const diffDays =
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) +
      1;

    if (diffDays > DATE_RANGE_CHUNK_DAYS_MAX) {
      return {
        ok: false,
        status: 400,
        error: 'validation',
        message: `Диапазон дат не должен превышать ${DATE_RANGE_CHUNK_DAYS_MAX} дней (указано ${diffDays}). Вызывайте батчами.`,
      };
    }

    const { error } = await admin.rpc('recalculate_ratings_for_date_range', {
      p_start_date: startStr,
      p_end_date: endStr,
    });

    if (error) {
      logError('InitializeRatings', 'Error recalculating ratings for date range', error);
      return {
        ok: false,
        status: 500,
        error: 'internal',
        message: error.message,
      };
    }

    logDebug('InitializeRatings', 'Metrics recalculated for date range', {
      startStr,
      endStr,
    });

    return {
      ok: true,
      data: {
        message: `Metrics recalculated from ${startStr} to ${endStr}. Вызовите с finalize_only: true для обновления рейтингов.`,
      },
    };
  }

  const rawDaysBack = body.days_back != null ? Number(body.days_back) : 30;
  const daysBack = Number.isFinite(rawDaysBack) ? Math.floor(rawDaysBack) : 30;

  if (daysBack < DAYS_BACK_MIN || daysBack > DAYS_BACK_MAX) {
    return {
      ok: false,
      status: 400,
      error: 'validation',
      message: `days_back должен быть от ${DAYS_BACK_MIN} до ${DAYS_BACK_MAX}`,
    };
  }

  const { error } = await admin.rpc('initialize_all_ratings', {
    p_days_back: daysBack,
  });

  if (error) {
    logError('InitializeRatings', 'Error initializing ratings', error);
    return {
      ok: false,
      status: 500,
      error: 'internal',
      message: error.message,
    };
  }

  logDebug('InitializeRatings', 'Successfully initialized ratings');
  return {
    ok: true,
    data: {
      message: `Ratings initialized for last ${daysBack} days`,
    },
  };
}
