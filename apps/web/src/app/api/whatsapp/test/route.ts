import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runWhatsAppTestHttp } from '@/lib/whatsAppTestHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    return withErrorHandler('WhatsAppTest', async () => runWhatsAppTestHttp());
}
