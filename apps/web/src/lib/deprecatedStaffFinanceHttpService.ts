import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runDeprecatedStaffFinance } from '@/lib/deprecatedStaffFinanceService';
import { logWarn } from '@/lib/log';
import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

type DeprecatedFinanceStaff = {
    id: string;
    biz_id: string | number | null;
    percent_master: number | null;
    percent_salon: number | null;
    hourly_rate: number | null;
};

export async function runDeprecatedStaffFinanceHttp(
    req: Request,
    context: unknown,
): Promise<NextResponse> {
    logWarn('StaffFinance', 'Deprecated endpoint used. Please migrate to /api/staff/finance?staffId={id}');

    return withManagerAndStaffContext<DeprecatedFinanceStaff>(
        req,
        context,
        {
            scope: 'StaffFinance',
            staffIdParamName: 'id',
            staffSelect: 'id, biz_id, percent_master, percent_salon, hourly_rate',
            notFoundMessage: 'Р РЋР С•РЎвЂљРЎР‚РЎС“Р Т‘Р Р…Р С‘Р С” Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р… Р С‘Р В»Р С‘ Р Т‘Р С•РЎРѓРЎвЂљРЎС“Р С— Р В·Р В°Р С—РЎР‚Р ВµРЎвЂ°Р ВµР Р…',
        },
        async ({ supabase, admin, bizId, staffId, staff }) => {
            const result = await runDeprecatedStaffFinance({
                req,
                supabase,
                admin,
                bizId,
                staffId,
                staff,
            });

            if (!result.ok) {
                return createErrorResponse(result.error, result.message, undefined, result.status);
            }

            return createSuccessResponse(result.data);
        },
    );
}
