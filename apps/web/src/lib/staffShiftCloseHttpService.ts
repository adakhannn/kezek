import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { determineErrorType, getIpAddress, logApiMetric } from '@/lib/apiMetrics';
import { getStaffContextForRequest } from '@/lib/authBiz';
import { logError } from '@/lib/log';
import { runStaffShiftClose } from '@/lib/staffShiftCloseService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { closeShiftSchema } from '@/lib/validation/schemas';

export async function runStaffShiftCloseHttp(req: Request): Promise<NextResponse> {
    const startTime = Date.now();
    const endpoint = '/api/staff/shift/close';
    let statusCode = 500;
    let staffId: string | undefined;
    let bizId: string | undefined;
    let userId: string | undefined;
    let errorMessage: string | undefined;

    try {
        const context = await getStaffContextForRequest(req, 'StaffShiftClose');
        const {
            supabase,
            userId: ctxUserId,
            staffId: ctxStaffId,
            bizId: ctxBizId,
        } = context;
        userId = ctxUserId;
        staffId = ctxStaffId;
        bizId = ctxBizId;

        const validationResult = await validateRequest(req, closeShiftSchema);
        if (!validationResult.success) {
            const validationError = await validationResult.response.json();
            const message = validationError.errors
                ? `Ошибка валидации: ${validationError.errors
                      .map((error: { path: string; message: string }) => `${error.path}: ${error.message}`)
                      .join(', ')}`
                : validationError.message || 'Ошибка валидации данных';
            statusCode = 400;
            return createErrorResponse('validation', message, undefined, 400);
        }

        const result = await runStaffShiftClose({
            supabase,
            staffId,
            bizId,
            items: validationResult.data.items ?? [],
            totalAmountRaw: validationResult.data.totalAmount ?? 0,
            consumablesAmount: validationResult.data.consumablesAmount ?? 0,
        });

        if (!result.ok) {
            statusCode = result.statusCode;
            return createErrorResponse(result.errorType, result.message, undefined, result.statusCode);
        }

        statusCode = 200;
        logApiMetric({
            endpoint,
            method: 'POST',
            statusCode,
            durationMs: Date.now() - startTime,
            userId,
            staffId,
            bizId,
            ipAddress: getIpAddress(req),
            userAgent: req.headers.get('user-agent') || undefined,
        }).catch(() => {});

        return createSuccessResponse({ shift: result.shift });
    } catch (error) {
        logError('StaffShiftClose', 'Unexpected error', error);
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isAuthError =
            error instanceof Error &&
            (error.message === 'UNAUTHORIZED' ||
                error.message.toLowerCase().includes('auth') ||
                error.message.toLowerCase().includes('unauthorized'));
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

        return createErrorResponse(isAuthError ? 'auth' : 'internal', errorMessage, undefined, statusCode);
    }
}
