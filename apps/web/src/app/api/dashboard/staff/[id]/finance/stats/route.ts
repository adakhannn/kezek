// apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts
import { withErrorHandler, createSuccessResponse } from '@/lib/apiErrorHandler';
import { logDebug } from '@/lib/log';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';
import { calculateOpenShiftAggregates, getShiftStatusGroups } from './financeStatsAggregates';
import { resolveFinanceStatsQuery } from './financeStatsParams';
import { buildFinanceStats } from './financeStatsPresentation';
import { loadFinanceStatsShiftItems } from './financeStatsShiftItems';
import { loadFinanceStatsShifts } from './financeStatsShifts';
import { loadFinanceStatsStaff } from './financeStatsStaff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
    req: Request,
    context: unknown
) {
    return withErrorHandler('StaffFinanceStats', async () => {
        const staffId = await getRouteParamUuid(context, 'id');
        return withManagerContext(req, 'StaffFinanceStats', async ({ supabase, admin, bizId, businessTz }) => {
            const query = resolveFinanceStatsQuery(req, businessTz);
            if (query instanceof Response) {
                return query;
            }
            const { period, date, dateFrom, dateTo } = query;

            const staff = await loadFinanceStatsStaff(supabase, staffId, bizId);
            if (staff instanceof Response) {
                return staff;
            }

            logDebug('StaffFinanceStats', 'Loading shifts', {
                staffId,
                bizId,
                dateFrom,
                dateTo,
                period,
                date,
            });

            const shiftResult = await loadFinanceStatsShifts({
                admin,
                bizId,
                staffId,
                businessTz,
                period,
                date,
                dateFrom,
                dateTo,
            });
            if (shiftResult instanceof Response) {
                return shiftResult;
            }
            const { finalShifts } = shiftResult;

            const shiftIds = (finalShifts || []).map(s => s.id);
            const shiftItemsMap = await loadFinanceStatsShiftItems(admin, shiftIds);

            const { closedShifts, openShifts } = getShiftStatusGroups(finalShifts);
            const {
                totalBaseMasterShare,
                totalGuaranteedAmount,
                hasGuaranteedPayment,
            } = calculateOpenShiftAggregates(openShifts, shiftItemsMap);

            const stats = buildFinanceStats({
                period,
                dateFrom,
                dateTo,
                staffName: staff.full_name,
                finalShifts,
                closedShiftsCount: closedShifts.length,
                openShiftsCount: openShifts.length,
                shiftItemsMap,
                totalBaseMasterShare,
                totalGuaranteedAmount,
                hasGuaranteedPayment,
            });

            return createSuccessResponse({ stats });
        });
    });
}

