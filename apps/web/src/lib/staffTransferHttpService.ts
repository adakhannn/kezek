import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { runStaffTransfer } from '@/lib/staffTransferService';

type Body = {
  target_branch_id: string;
  copy_schedule?: boolean;
};

export async function runStaffTransferHttp(
  req: Request,
  context: unknown,
): Promise<NextResponse> {
  const staffId = await getRouteParamRequired(context, 'id');
  const { bizId } = await getBizContextForManagers();

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch (error) {
    logError('StaffTransfer', 'Error parsing JSON', error);
    return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
  }

  const result = await runStaffTransfer({
    admin: getServiceClient(),
    bizId,
    staffId,
    body,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}
