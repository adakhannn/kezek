import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { getRouteParamUuid } from '@/lib/routeParams';
import { runStaffUpdate } from '@/lib/staffUpdateService';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  branch_id: string;
  is_active: boolean;
};

export async function runStaffUpdateHttp(
  req: Request,
  context: unknown,
): Promise<NextResponse> {
  const staffId = await getRouteParamUuid(context, 'id');
  const { supabase, userId, bizId } = await getBizContextForManagers();
  const admin = getServiceClient();

  let body: Body;
  try {
    body = await req.json();
  } catch (error) {
    logError('StaffUpdate', 'Error parsing JSON', error);
    return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
  }

  const result = await runStaffUpdate({
    supabase,
    admin,
    staffId,
    userId,
    bizId,
    body,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}
