import { runAnalyticsDailyCronHttp } from '@/lib/analyticsDailyCronHttpService';
import { withErrorHandler } from '@/lib/apiErrorHandler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

async function handle(req: Request) {
    return withErrorHandler('AnalyticsDailyCron', async () =>
        runAnalyticsDailyCronHttp(req, CRON_SECRET),
    );
}

export async function POST(req: Request) {
    return handle(req);
}

export async function GET(req: Request) {
    return handle(req);
}
