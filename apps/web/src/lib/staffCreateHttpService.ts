import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { runStaffCreate } from '@/lib/staffCreateService';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  branch_id: string;
  is_active: boolean;
};

export async function runStaffCreateHttp(req: Request): Promise<NextResponse> {
  const { supabase, userId, bizId } = await getBizContextForManagers();

  let body: Body;
  try {
    body = await req.json();
  } catch (error) {
    logError('StaffCreate', 'Error parsing JSON', error);
    return createErrorResponse('validation', 'Неверный формат JSON', undefined, 400);
  }

  const result = await runStaffCreate({
    supabase,
    admin: getServiceClient(),
    userId,
    bizId,
    body,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.data);
}
