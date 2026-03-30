export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runWhatsAppBusinessAccountLookupHttp } from '@/lib/whatsAppAccountLookupHttpService';

export async function GET() {
  return withErrorHandler('WhatsAppAPI', async () => runWhatsAppBusinessAccountLookupHttp());
}
