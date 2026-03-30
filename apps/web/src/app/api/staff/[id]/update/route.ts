export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffUpdateByIdHttp } from '@/lib/staffUpdateByIdHttpService';

export async function POST(req: Request, context: unknown) {
    return withErrorHandler('StaffUpdate', async () => runStaffUpdateByIdHttp(req, context));
}
