import { NextRequest, NextResponse } from 'next/server';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { getWhatsAppVerifyToken } from '@/lib/env';

export function verifyWhatsAppWebhookRequest(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = getWhatsAppVerifyToken();
    if (mode === 'subscribe' && token === verifyToken) {
        return new NextResponse(challenge, { status: 200 });
    }

    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
}
