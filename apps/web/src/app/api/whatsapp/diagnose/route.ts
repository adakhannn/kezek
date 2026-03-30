export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {
    withErrorHandler,
} from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runWhatsAppDiagnoseHttp } from '@/lib/whatsAppDiagnoseHttpService';

export async function GET(req: Request) {
    return withRateLimit(req, RateLimitConfigs.normal, () =>
        withErrorHandler('WhatsAppDiagnose', async () => runWhatsAppDiagnoseHttp()),
    );
}
