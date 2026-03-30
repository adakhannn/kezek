import { NextRequest, NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import {
  runMobileExchangeGet,
  runMobileExchangePost,
  type MobileExchangeGetResult,
} from '@/lib/mobileExchangeRouteService';

type MobileExchangeSuccessPayload = Extract<MobileExchangeGetResult, { ok: true }>['payload'];

export async function runMobileExchangePostHttp(request: NextRequest): Promise<NextResponse> {
  const { accessToken, refreshToken } = await request.json();
  const result = runMobileExchangePost({ accessToken, refreshToken });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.payload);
}

export async function runMobileExchangeGetHttp(
  request: NextRequest,
): Promise<NextResponse<{ ok: true; data?: MobileExchangeSuccessPayload } | { ok: false; error: string }>> {
  const searchParams = request.nextUrl.searchParams;
  const result = runMobileExchangeGet({
    code: searchParams.get('code'),
    check: searchParams.get('check') === 'true',
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, undefined, result.status);
  }

  return createSuccessResponse(result.payload);
}
