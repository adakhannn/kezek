export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffSyncRolesHttp } from '@/lib/staffSyncRolesHttpService';

/**
 * РЎРёРЅС…СЂРѕРЅРёР·РёСЂСѓРµС‚ СЂРѕР»Рё staff РґР»СЏ РІСЃРµС… СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ Р±РёР·РЅРµСЃР°, Сѓ РєРѕС‚РѕСЂС‹С… РµСЃС‚СЊ user_id, РЅРѕ РЅРµС‚ СЂРѕР»Рё staff
 */
export async function POST(req: Request) {
    return withErrorHandler('StaffSyncRoles', async () => {
        return runStaffSyncRolesHttp();
    });
}
