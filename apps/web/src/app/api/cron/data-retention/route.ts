import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDataRetentionCronHttp } from '@/lib/dataRetentionCronHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

export async function GET(req: Request) {
    return withErrorHandler('DataRetentionCron', async () =>
        runDataRetentionCronHttp(req, CRON_SECRET),
    );
}
