import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffShiftTodayHttp } from '@/lib/staffShiftTodayHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    return withErrorHandler('StaffShiftToday', async () => runStaffShiftTodayHttp());
}
