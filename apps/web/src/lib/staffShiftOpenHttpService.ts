import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse, DATABASE_FAILURE_MESSAGES, publicErrorMessage, staffAccessErrorResponse } from '@/lib/apiErrorHandler';
import { determineErrorType, getIpAddress, logApiMetric } from '@/lib/apiMetrics';
import { getStaffContextForRequest } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { checkVerifiedPrincipalRateLimit, rateLimitDeniedResponse, RateLimitConfigs } from '@/lib/rateLimit';
import { runOpenStaffShift } from '@/lib/staffShiftOpenService';

export async function runStaffShiftOpenHttp(req: Request): Promise<NextResponse> {
    const startTime = Date.now();
    const endpoint = '/api/staff/shift/open';
    let statusCode = 500;
    let staffId: string | undefined;
    let bizId: string | undefined;
    let userId: string | undefined;
    let errorMessage: string | undefined;

    try {
        const context = await getStaffContextForRequest(req, 'StaffShiftOpen');
        const { supabase, staffId: contextStaffId, bizId: contextBizId, branchId } = context;

        staffId = contextStaffId;
        bizId = contextBizId;

        userId = context.userId;
        const limit = await checkVerifiedPrincipalRateLimit(req, endpoint, { userId: context.userId, bizId: contextBizId }, RateLimitConfigs.critical);
        if (!limit.success) return rateLimitDeniedResponse(limit);

        const result = await runOpenStaffShift({
            supabase,
            staffId,
            bizId,
            branchId,
            requestedDate: new URL(req.url).searchParams.get('date') ?? undefined,
        });

        statusCode = result.status;
        errorMessage = result.ok ? undefined : result.message;

        logApiMetric({
            endpoint,
            method: 'POST',
            statusCode,
            durationMs: Date.now() - startTime,
            userId,
            staffId,
            bizId,
            errorMessage,
            errorType: determineErrorType(statusCode, errorMessage) || undefined,
            ipAddress: getIpAddress(req),
            userAgent: req.headers.get('user-agent') || undefined,
        }).catch(() => {});

        if (!result.ok) {
            return createErrorResponse(result.error, result.message, undefined, result.status);
        }

        return createSuccessResponse({ shift: result.shift });
    } catch (error) {
        // Staff card refusals (ARCH-02) are ordinary 400/403 answers, not server errors.
        const access = staffAccessErrorResponse(error);
        if (!access) logError('StaffShiftOpen', 'Unexpected error', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        const isAuthError =
            !access &&
            error instanceof Error &&
            (error.message === 'UNAUTHORIZED' ||
                error.message.toLowerCase().includes('auth') ||
                error.message.toLowerCase().includes('unauthorized'));

        errorMessage = message;
        statusCode = access ? access.status : isAuthError ? 401 : 500;

        logApiMetric({
            endpoint,
            method: 'POST',
            statusCode,
            durationMs: Date.now() - startTime,
            userId,
            staffId,
            bizId,
            errorMessage,
            errorType: determineErrorType(statusCode, errorMessage) || undefined,
            ipAddress: getIpAddress(req),
            userAgent: req.headers.get('user-agent') || undefined,
        }).catch(() => {});

        return access ?? createErrorResponse(isAuthError ? 'auth' : 'internal', publicErrorMessage(error, isAuthError ? 'Не авторизован' : DATABASE_FAILURE_MESSAGES.internal), undefined, statusCode);
    }
}
