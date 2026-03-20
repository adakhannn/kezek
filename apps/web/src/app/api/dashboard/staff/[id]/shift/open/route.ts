// apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts
import { withErrorHandler, createSuccessResponse } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';
import { resolveOwnerShiftOpenQuery } from './ownerShiftOpenParams';
import { loadOwnerExistingShift, persistOwnerShiftOpen } from './ownerShiftOpenPersistence';
import { resolveOwnerShiftTiming } from './ownerShiftOpenSchedule';
import { loadOwnerShiftOpenStaff } from './ownerShiftOpenStaff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST - РћС‚РєСЂС‹С‚СЊ СЃРјРµРЅСѓ РґР»СЏ СЃРѕС‚СЂСѓРґРЅРёРєР° (РґР»СЏ РІР»Р°РґРµР»СЊС†Р°/РјРµРЅРµРґР¶РµСЂР°)
 */
export async function POST(
    req: Request,
    context: unknown
) {
    return withRateLimit(
        req,
        RateLimitConfigs.critical,
        async () => {
            return withErrorHandler('OwnerShiftOpen', async () => {
                const staffId = await getRouteParamUuid(context, 'id');
                return withManagerContext(req, 'OwnerShiftOpen', async ({ supabase, admin, bizId, businessTz }) => {
                    const { targetDate, ymd } = resolveOwnerShiftOpenQuery(req, businessTz);

                    const staff = await loadOwnerShiftOpenStaff(supabase, staffId, bizId);
                    if (staff instanceof Response) {
                        return staff;
                    }

                    const existingShift = await loadOwnerExistingShift({
                        admin,
                        staffId,
                        ymd,
                    });
                    if (existingShift instanceof Response) {
                        return existingShift;
                    }

                    const { openedAt, lateMinutes } = await resolveOwnerShiftTiming({
                        supabase,
                        bizId,
                        staffId,
                        targetDate,
                        ymd,
                        businessTz,
                    });

                    const persistResult = await persistOwnerShiftOpen({
                        admin,
                        existingShift,
                        staff,
                        staffId,
                        bizId,
                        ymd,
                        openedAt,
                        lateMinutes,
                    });
                    if (persistResult instanceof Response) {
                        return persistResult;
                    }

                    return createSuccessResponse(persistResult);
                });
            });
        }
    );
}

