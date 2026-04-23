export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runTelegramWebhookPostHttp } from '@/lib/telegramWebhookHttpService';

export async function POST(req: NextRequest) {
    return withErrorHandler('TelegramWebhook', async () => runTelegramWebhookPostHttp(req));
}
