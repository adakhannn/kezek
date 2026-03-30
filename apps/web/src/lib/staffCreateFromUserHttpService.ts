import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { runStaffCreateFromUser } from '@/lib/staffCreateFromUserService';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
  user_id: string;
  branch_id: string;
  is_active?: boolean;
};

export async function runStaffCreateFromUserHttp(req: Request): Promise<NextResponse> {
  const { bizId } = await getBizContextForManagers();

  let body: Body;
  try {
    body = await req.json();
  } catch (error) {
    logError('StaffCreateFromUser', 'Error parsing JSON', error);
    return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
  }

  const result = await runStaffCreateFromUser({
    admin: getServiceClient(),
    bizId,
    body,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}
