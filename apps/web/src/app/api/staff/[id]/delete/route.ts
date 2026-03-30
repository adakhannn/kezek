export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffDeleteHttp } from '@/lib/staffDeleteHttpService';

export async function POST(_: Request, context: unknown) {
  return withErrorHandler('StaffDelete', () => runStaffDeleteHttp(context));
}
