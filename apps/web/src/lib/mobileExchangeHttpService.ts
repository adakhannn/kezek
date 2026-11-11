import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runMobileExchangeGet, runMobileExchangePost } from '@/lib/mobileExchangeRouteService';

function privateResponse(response: NextResponse) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
}

export async function runMobileExchangePostHttp(request: Request): Promise<NextResponse> {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !['code', 'codeVerifier'].includes(key))) {
        return privateResponse(createErrorResponse('validation', 'Некорректный запрос входа', undefined, 400));
    }
    try {
        const result = await runMobileExchangePost(body);
        return privateResponse(result.ok ? createSuccessResponse(result.payload)
            : createErrorResponse(result.error, result.message, undefined, result.status));
    } catch {
        // Storage/Auth failures must not leak a grant, token or provider response.
        return privateResponse(createErrorResponse('service_unavailable', 'Вход временно недоступен. Начните заново.', undefined, 503));
    }
}

export async function runMobileExchangeGetHttp(): Promise<NextResponse> {
    const result = runMobileExchangeGet();
    return privateResponse(createErrorResponse(result.error, result.message, undefined, result.status));
}
