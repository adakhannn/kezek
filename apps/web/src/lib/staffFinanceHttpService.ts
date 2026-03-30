import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { determineErrorType, getIpAddress, logApiMetric } from '@/lib/apiMetrics';
import { logDebug, logError } from '@/lib/log';
import { runStaffFinanceRoute } from '@/lib/staffFinanceRouteService';

export async function runStaffFinanceHttp(req: Request): Promise<NextResponse> {
    const startTime = Date.now();
    const endpoint = '/api/staff/finance';
    let statusCode = 500;
    let staffId: string | undefined;
    let bizId: string | undefined;
    let userId: string | undefined;
    let errorMessage: string | undefined;

    try {
        const result = await runStaffFinanceRoute(req);
        const durationMs = Date.now() - startTime;

        if (!result.ok) {
            statusCode = result.status;
            errorMessage = result.message;
            staffId = result.metric?.staffId;
            bizId = result.metric?.bizId;
            userId = result.metric?.userId;

            logApiMetric({
                endpoint,
                method: 'GET',
                statusCode,
                durationMs,
                userId,
                staffId,
                bizId,
                errorMessage,
                errorType: determineErrorType(statusCode, errorMessage) || undefined,
                ipAddress: getIpAddress(req),
                userAgent: req.headers.get('user-agent') || undefined,
            }).catch(() => {});

            return createErrorResponse(result.error, result.message, undefined, result.status);
        }

        statusCode = 200;
        staffId = result.metric.staffId;
        bizId = result.metric.bizId;
        userId = result.metric.userId;

        logDebug('StaffFinance', 'Timing', {
            durationMs,
            endpoint,
            staffId,
            bizId,
            date: result.metric.date,
            useServiceClient: result.metric.useServiceClient,
        });

        logApiMetric({
            endpoint,
            method: 'GET',
            statusCode,
            durationMs,
            userId,
            staffId,
            bizId,
            ipAddress: getIpAddress(req),
            userAgent: req.headers.get('user-agent') || undefined,
        }).catch(() => {});

        return createSuccessResponse(result.data);
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logError('StaffFinance', 'Unexpected error in /api/staff/finance', error);

        errorMessage = msg;
        statusCode =
            error instanceof Error &&
            (error.message === 'UNAUTHORIZED' || error.message === 'NO_STAFF_RECORD' || error.message === 'NO_BIZ_ACCESS')
                ? 401
                : 500;

        logApiMetric({
            endpoint,
            method: 'GET',
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

        return createErrorResponse(statusCode === 401 ? 'auth' : 'internal', msg, undefined, statusCode);
    }
}
