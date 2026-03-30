import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runAnalyticsHourlyLoadCronHttp } from '@/lib/analyticsHourlyLoadCronHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

async function handle(req: Request) {
    return withErrorHandler('AnalyticsHourlyCron', async () =>
        runAnalyticsHourlyLoadCronHttp(req, CRON_SECRET),
    );
}

export async function POST(req: Request) {
    return handle(req);
}

export async function GET(req: Request) {
    return handle(req);
}
