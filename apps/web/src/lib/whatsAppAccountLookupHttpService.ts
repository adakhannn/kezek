import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getWhatsAppAccessToken } from '@/lib/env';
import {
  loadWhatsAppBusinessAccountData,
  loadWhatsAppPhoneNumbers,
} from '@/lib/whatsAppAccountLookupService';

export async function runWhatsAppBusinessAccountLookupHttp(): Promise<NextResponse> {
  let accessToken: string;
  try {
    accessToken = getWhatsAppAccessToken();
  } catch {
    return createErrorResponse(
      'internal',
      'WHATSAPP_ACCESS_TOKEN не установлен в переменных окружения',
      { code: 'no_token' },
      500,
    );
  }

  const result = await loadWhatsAppBusinessAccountData({
    accessToken,
    fetchImpl: fetch,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.data);
}

export async function runWhatsAppPhoneNumbersLookupHttp(req: Request): Promise<NextResponse> {
  let accessToken: string;
  try {
    accessToken = getWhatsAppAccessToken();
  } catch {
    return createErrorResponse(
      'internal',
      'WHATSAPP_ACCESS_TOKEN не установлен в переменных окружения',
      { code: 'no_token' },
      500,
    );
  }

  const result = await loadWhatsAppPhoneNumbers({
    accessToken,
    accountId: new URL(req.url).searchParams.get('account_id'),
    fetchImpl: fetch,
  });

  if (!result.ok) {
    return createErrorResponse(result.error, result.message, result.details, result.status);
  }

  return createSuccessResponse(result.data);
}


