import { NextRequest } from 'next/server';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import {
  runMobileExchangeGetHttp,
  runMobileExchangePostHttp,
} from '@/lib/mobileExchangeHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  return withRateLimit(request, RateLimitConfigs.auth, () =>
    withErrorHandler('MobileExchange', () => runMobileExchangePostHttp(request)),
  );
}

export async function GET(request: NextRequest) {
  return withErrorHandler('MobileExchange', () => runMobileExchangeGetHttp(request));
}
