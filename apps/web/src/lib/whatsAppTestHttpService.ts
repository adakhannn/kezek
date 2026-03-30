import { NextResponse } from 'next/server';

import { createSuccessResponse } from '@/lib/apiErrorHandler';
import { getWhatsAppTestSnapshot } from '@/lib/whatsAppTestService';

export function runWhatsAppTestHttp(env: NodeJS.ProcessEnv = process.env): NextResponse {
    return createSuccessResponse(getWhatsAppTestSnapshot(env));
}
