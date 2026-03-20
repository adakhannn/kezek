import { determineErrorType, getIpAddress, logApiMetric } from '@/lib/apiMetrics';

type ShiftItemsMetricParams = {
    bizId?: string;
    durationMs: number;
    endpoint: string;
    errorMessage?: string;
    method: 'POST';
    req: Request;
    staffId?: string;
    statusCode: number;
    userId?: string;
};

export function logShiftItemsApiMetric({
    bizId,
    durationMs,
    endpoint,
    errorMessage,
    method,
    req,
    staffId,
    statusCode,
    userId,
}: ShiftItemsMetricParams) {
    return logApiMetric({
        endpoint,
        method,
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
}
