import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';

import { logShiftItemsApiMetric } from './shiftItemsApiMetrics';
import type { ShiftItemsWorkflowMeta, WorkflowError } from './shiftItemsTypes';

type ShiftItemsHttpContext = {
    endpoint: string;
    req: Request;
    startTime: number;
};

export function createShiftItemsValidationHttpResponse(params: {
    context: ShiftItemsHttpContext;
    errorMessage: string;
}) {
    const { context, errorMessage } = params;
    const statusCode = 400;

    logShiftItemsApiMetric({
        endpoint: context.endpoint,
        method: 'POST',
        statusCode,
        durationMs: Date.now() - context.startTime,
        errorMessage,
        req: context.req,
    });

    return createErrorResponse('validation', errorMessage, undefined, statusCode);
}

export function createShiftItemsUseCaseHttpResponse(params: {
    context: ShiftItemsHttpContext;
    result:
        | { ok: true; meta: ShiftItemsWorkflowMeta }
        | { ok: false; error: WorkflowError; meta?: ShiftItemsWorkflowMeta };
}) {
    const { context, result } = params;

    if (result.ok) {
        return createSuccessResponse();
    }

    logShiftItemsApiMetric({
        endpoint: context.endpoint,
        method: 'POST',
        statusCode: result.error.statusCode,
        durationMs: Date.now() - context.startTime,
        userId: result.meta?.userId,
        staffId: result.meta?.staffId,
        bizId: result.meta?.bizId,
        errorMessage: result.error.message,
        req: context.req,
    });

    return createErrorResponse(result.error.type, result.error.message, undefined, result.error.statusCode);
}
