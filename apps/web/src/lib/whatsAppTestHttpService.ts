import { NextResponse } from 'next/server';

import { requireCurrentSuperAdmin } from '@/lib/adminHttpAccess';
import { createSuccessResponse } from '@/lib/apiErrorHandler';
import { getWhatsAppTestSnapshot } from '@/lib/whatsAppTestService';

export async function runWhatsAppTestHttp(env: NodeJS.ProcessEnv = process.env): Promise<NextResponse> {
    const access = await requireCurrentSuperAdmin();
    if (!access.ok) return access.response;
    return createSuccessResponse(getWhatsAppTestSnapshot(env));
}
