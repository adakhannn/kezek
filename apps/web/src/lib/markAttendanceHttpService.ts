import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { managerAccessToBusiness } from '@/lib/businessManagerAccess';
import { runMarkAttendance } from '@/lib/markAttendanceService';
import { hasBearerAuthorization, resolveRequestAuthContext } from '@/lib/requestAuthContext';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { markAttendanceSchema } from '@/lib/validation/schemas';

type Actor = { bizId: string; userId: string } | NextResponse;

/**
 * The app's Bearer caller (O1): the business is the booking's, and the caller must manage it
 * (managerAccessToBusiness), since the app has no "current business" cookie. 404 for a missing
 * booking, 403 otherwise; the SQL command checks business and actor again.
 */
async function resolveBearerActor(req: Request, bookingId: string, admin: ReturnType<typeof getServiceClient>): Promise<Actor> {
  const auth = await resolveRequestAuthContext(req, 'BookingsMarkAttendance');
  if (auth instanceof NextResponse) return auth;
  const { data: booking, error } = await admin.from('bookings').select('biz_id').eq('id', bookingId).maybeSingle();
  if (error) return createErrorResponse('internal', 'Внутренняя ошибка сервера', undefined, 500);
  if (!booking?.biz_id) return createErrorResponse('not_found', 'Бронь не найдена', undefined, 404);
  const access = await managerAccessToBusiness(admin, auth.user.id, String(booking.biz_id));
  if (access !== 'manager') return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
  return { bizId: String(booking.biz_id), userId: auth.user.id };
}

export async function runMarkAttendanceHttp(
  req: Request,
  context: unknown,
): Promise<NextResponse> {
  const bookingId = await getRouteParamUuid(context, 'id');
  const admin = getServiceClient();
  const actor: Actor = hasBearerAuthorization(req)
    ? await resolveBearerActor(req, bookingId, admin)
    : await getBizContextForManagers();
  if (actor instanceof NextResponse) return actor;
  const { bizId, userId } = actor;

  const validationResult = await validateRequest(req, markAttendanceSchema);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const result = await runMarkAttendance({
    admin,
    bookingId,
    bizId,
    actorId: userId,
    attended: validationResult.data.attended,
  });

  if (!result.ok) {
    return createErrorResponse(result.errorType, result.message, undefined, result.statusCode);
  }

  return createSuccessResponse(undefined, result.payload);
}
