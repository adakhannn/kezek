import { NextRequest, NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getWhatsAppVerifyToken } from '@/lib/env';
import { processWhatsAppWebhookBody } from '@/lib/whatsAppWebhookService';

export async function runWhatsAppWebhookGetHttp(req: NextRequest): Promise<NextResponse> {
    const searchParams = new URL(req.url).searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === getWhatsAppVerifyToken()) {
        return new NextResponse(challenge, { status: 200 });
    }

    return createErrorResponse('forbidden', 'Р”РѕСЃС‚СѓРї Р·Р°РїСЂРµС‰РµРЅ', undefined, 403);
}

export async function runWhatsAppWebhookPostHttp(req: NextRequest): Promise<NextResponse> {
    const body = await req.json();

    await processWhatsAppWebhookBody(body);

    return createSuccessResponse(undefined, { success: true });
}
