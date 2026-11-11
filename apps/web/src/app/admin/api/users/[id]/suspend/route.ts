import { runUserLifecycleHttp } from '@/lib/userLifecycleHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, context: unknown) {
    return runUserLifecycleHttp(req, context, 'suspend');
}
