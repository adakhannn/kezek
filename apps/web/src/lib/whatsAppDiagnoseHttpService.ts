import { NextResponse } from 'next/server';

import { requireCurrentSuperAdmin } from '@/lib/adminHttpAccess';
import {
    createErrorResponse,
    createSuccessResponse,
} from '@/lib/apiErrorHandler';
import { runWhatsAppDiagnoseRoute } from '@/lib/whatsAppDiagnoseRouteService';

export async function runWhatsAppDiagnoseHttp(): Promise<NextResponse> {
    const access = await requireCurrentSuperAdmin();
    if (!access.ok) return access.response;
    const result = await runWhatsAppDiagnoseRoute({
        env: process.env,
    });

    if (!result.ok) {
        return createErrorResponse(
            result.error,
            result.message,
            result.details,
            result.status,
        );
    }

    return createSuccessResponse(result.payload);
}
