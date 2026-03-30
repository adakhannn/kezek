import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffDismissHttp } from '@/lib/staffDismissHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_: Request, context: unknown) {
    return withErrorHandler('StaffDismiss', async () => runStaffDismissHttp(context));
}
