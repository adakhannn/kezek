/**
 * @deprecated РСЃРїРѕР»СЊР·СѓР№С‚Рµ /api/staff/finance?staffId={id}&date={date} РІРјРµСЃС‚Рѕ СЌС‚РѕРіРѕ endpoint
 * Р­С‚РѕС‚ endpoint СЃРѕС…СЂР°РЅРµРЅ РґР»СЏ РѕР±СЂР°С‚РЅРѕР№ СЃРѕРІРјРµСЃС‚РёРјРѕСЃС‚Рё
 * 
 * РњРёРіСЂР°С†РёСЏ:
 * - РЎС‚Р°СЂС‹Р№: GET /api/dashboard/staff/[id]/finance?date=YYYY-MM-DD
 * - РќРѕРІС‹Р№: GET /api/staff/finance?staffId={id}&date=YYYY-MM-DD
 */
// apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts
import { resolveFinanceByIdQuery } from './financeByIdParams';
import { loadFinanceByIdRelatedData } from './financeByIdRelatedData';
import { buildFinanceByIdResponse } from './financeByIdResponse';
import { resolveFinanceByIdShiftContext } from './financeByIdShiftContext';
import { loadFinanceByIdShiftItems } from './financeByIdShiftItems';
import { loadFinanceByIdStaff } from './financeByIdStaff';
import { loadFinanceByIdStats } from './financeByIdStats';

import { withErrorHandler, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logWarn } from '@/lib/log';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
    req: Request,
    context: unknown
) {
    return withErrorHandler('StaffFinance', async () => {
        logWarn('StaffFinance', 'Deprecated endpoint used. Please migrate to /api/staff/finance?staffId={id}');
        const staffId = await getRouteParamUuid(context, 'id');
        return withManagerContext(req, 'StaffFinance', async ({ supabase, admin, bizId, businessTz }) => {
            const query = resolveFinanceByIdQuery(req);
            if (query instanceof Response) {
                return query;
            }
            const { targetDate } = query;

            const staff = await loadFinanceByIdStaff(supabase, staffId, bizId);
            if (staff instanceof Response) {
                return staff;
            }

            const staffPercentMaster = Number(staff.percent_master ?? 60);
            const staffPercentSalon = Number(staff.percent_salon ?? 40);
            const hourlyRate = staff.hourly_rate ? Number(staff.hourly_rate) : null;

            const shiftContext = await resolveFinanceByIdShiftContext({
                supabase,
                admin,
                bizId,
                staffId,
                targetDate,
                businessTz,
            });
            if (shiftContext instanceof Response) {
                return shiftContext;
            }
            const { ymd, isDayOff, shift } = shiftContext;

            const [items, relatedData, statsData] = await Promise.all([
                loadFinanceByIdShiftItems(admin, shift?.id),
                loadFinanceByIdRelatedData({ supabase, staffId, ymd }),
                loadFinanceByIdStats({
                    admin,
                    bizId,
                    staffId,
                    targetDate,
                    businessTz,
                    shift,
                    hourlyRate,
                }),
            ]);

            return createSuccessResponse(
                buildFinanceByIdResponse({
                    shift,
                    items,
                    bookings: relatedData.bookings,
                    services: relatedData.services,
                    allShifts: statsData.allShifts,
                    staffPercentMaster,
                    staffPercentSalon,
                    hourlyRate,
                    currentHoursWorked: statsData.currentHoursWorked,
                    currentGuaranteedAmount: statsData.currentGuaranteedAmount,
                    isDayOff,
                    stats: statsData.stats,
                })
            );
        });
    });
}

