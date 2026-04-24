export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffSyncRolesHttp } from '@/lib/staffSyncRolesHttpService';

/**
 * Синхронизирует роли staff для всех сотрудников бизнеса, у которых есть user_id, но нет роли staff
 */
export async function POST(req: Request) {
    return withErrorHandler('StaffSyncRoles', async () => {
        return runStaffSyncRolesHttp();
    });
}

