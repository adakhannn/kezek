import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { runFinanceAllDashboard } from '@/lib/financeAllDashboardService';
import { withManagerContext } from '@/lib/withManagerContext';

export async function runFinanceAllDashboardHttp(req: Request): Promise<NextResponse> {
    return withManagerContext(req, 'FinanceAll', async ({ supabase, admin, bizId }) => {
        const result = await runFinanceAllDashboard({ req, supabase, admin, bizId });

        if (!result.ok) {
            return createErrorResponse(result.errorType, result.message, result.details, result.statusCode);
        }

        return createSuccessResponse(result.data);
    });
}
