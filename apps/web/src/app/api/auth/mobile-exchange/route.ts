import { NextRequest } from 'next/server';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import {
  runMobileExchangeGetHttp,
  runMobileExchangePostHttp,
} from '@/lib/mobileExchangeHttpService';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  return withRateLimit(request, routeRateLimit('api/auth/mobile-exchange', RateLimitConfigs.auth), () =>
    withErrorHandler('MobileExchange', () => runMobileExchangePostHttp(request)),
      "/api/auth/mobile-exchange",
  );
}

export async function GET() {
  return runMobileExchangeGetHttp();
}
