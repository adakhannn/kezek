export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffRestoreHttp } from '@/lib/staffRestoreHttpService';

export async function POST(_: Request, context: unknown) {
  return withErrorHandler('StaffRestore', () => runStaffRestoreHttp(context));
}
