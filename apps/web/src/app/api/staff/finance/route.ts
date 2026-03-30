/**
 * Р•РґРёРЅС‹Р№ API endpoint РґР»СЏ РїРѕР»СѓС‡РµРЅРёСЏ РґР°РЅРЅС‹С… СЃРјРµРЅС‹ СЃРѕС‚СЂСѓРґРЅРёРєР°
 * РџРѕРґРґРµСЂР¶РёРІР°РµС‚ РєР°Рє СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ (С‡РµСЂРµР· getStaffContext), С‚Р°Рє Рё РјРµРЅРµРґР¶РµСЂРѕРІ (С‡РµСЂРµР· getBizContextForManagers)
 * 
 * Query РїР°СЂР°РјРµС‚СЂС‹:
 * - staffId (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ) - ID СЃРѕС‚СЂСѓРґРЅРёРєР° (РґР»СЏ РјРµРЅРµРґР¶РµСЂРѕРІ)
 * - date (РѕРїС†РёРѕРЅР°Р»СЊРЅРѕ) - РґР°С‚Р° РІ С„РѕСЂРјР°С‚Рµ YYYY-MM-DD (РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ СЃРµРіРѕРґРЅСЏ)
 */

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffFinanceHttp } from '@/lib/staffFinanceHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    return withErrorHandler('StaffFinance', async () => runStaffFinanceHttp(req));
}
