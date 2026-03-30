import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import {
  createServiceRouteEntry,
  type ServiceCreateAdminLike,
  type ServiceCreateBody,
} from '@/lib/serviceCreateRouteService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runServiceCreateHttp(req: Request): Promise<NextResponse> {
  const { bizId } = await getBizContextForManagers();
  const body = (await req.json().catch(() => ({}))) as ServiceCreateBody;

  const result = await createServiceRouteEntry({
    admin: getServiceClient() as unknown as ServiceCreateAdminLike,
    bizId,
    body,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.data);
}
