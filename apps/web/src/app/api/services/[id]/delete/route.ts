export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {
    withErrorHandler,
} from '@/lib/apiErrorHandler';
import { runServiceDeleteHttp } from '@/lib/serviceDeleteHttpService';

export async function POST(_req: Request, context: unknown) {
    return withErrorHandler('ServicesDelete', async () => {
        return runServiceDeleteHttp(context);
    });
}
