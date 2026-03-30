export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import {
    runWhatsAppWebhookGetHttp,
    runWhatsAppWebhookPostHttp,
} from '@/lib/whatsAppWebhookHttpService';

export async function GET(req: NextRequest) {
    return withErrorHandler('WhatsAppWebhook', async () => runWhatsAppWebhookGetHttp(req));
}

export async function POST(req: NextRequest) {
    return withErrorHandler('WhatsAppWebhook', async () => runWhatsAppWebhookPostHttp(req));
}
