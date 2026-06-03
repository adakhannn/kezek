import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { determineErrorType, getIpAddress, logApiMetric } from '@/lib/apiMetrics';
import { getStaffContextForRequest } from '@/lib/authBiz';
import { logError } from '@/lib/log';
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

        const {
            data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id;

        const result = await runOpenStaffShift({
            supabase,
            staffId,
            bizId,
            branchId,
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
        logError('StaffShiftOpen', 'Unexpected error', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        const isAuthError =
            error instanceof Error &&
            (error.message === 'UNAUTHORIZED' ||
                error.message.toLowerCase().includes('auth') ||
                error.message.toLowerCase().includes('unauthorized'));

        errorMessage = message;
        statusCode = isAuthError ? 401 : 500;

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

        return createErrorResponse(isAuthError ? 'auth' : 'internal', message, undefined, statusCode);
    }
}
