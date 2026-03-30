import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { runMarkAttendance } from '@/lib/markAttendanceService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { markAttendanceSchema } from '@/lib/validation/schemas';

export async function runMarkAttendanceHttp(
  req: Request,
  context: unknown,
): Promise<NextResponse> {
  const bookingId = await getRouteParamUuid(context, 'id');
  const { bizId } = await getBizContextForManagers();
  const admin = getServiceClient();

  const validationResult = await validateRequest(req, markAttendanceSchema);
  if (!validationResult.success) {
    return validationResult.response;
  }

  const result = await runMarkAttendance({
    admin,
    bookingId,
    bizId,
    attended: validationResult.data.attended,
  });

  if (!result.ok) {
    return createErrorResponse(result.errorType, result.message, undefined, result.statusCode);
  }

  return createSuccessResponse(undefined, result.payload);
}
