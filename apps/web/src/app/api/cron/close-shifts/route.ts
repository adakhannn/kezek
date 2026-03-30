import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runCloseShiftsCronHttp } from '@/lib/closeShiftsCronHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function GET(req: Request) {
    return withErrorHandler('CloseShiftsCron', async () =>
        runCloseShiftsCronHttp(req, CRON_SECRET),
    );
}
