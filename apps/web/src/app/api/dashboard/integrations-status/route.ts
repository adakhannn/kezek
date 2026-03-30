import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runIntegrationsStatusHttp } from '@/lib/integrationsStatusHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    return withErrorHandler('IntegrationsStatus', async () =>
        runIntegrationsStatusHttp(req),
    );
}
