import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { ensureSuperAdminAccess } from '@/lib/ratingsDebugEntitiesService';
import { runRatingsManualRecalculate } from '@/lib/ratingsManualRecalculateService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

export async function runRatingsManualRecalculateHttp(req: Request): Promise<NextResponse> {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    const accessResult = await ensureSuperAdminAccess({
        supabase: supabase as never,
    });
    if (!accessResult.ok) {
        return createErrorResponse(accessResult.error, accessResult.message, undefined, accessResult.status);
    }

    const body = (await req.json().catch(() => ({}))) as {
        entity_type?: 'staff' | 'branch' | 'biz';
        entity_id?: string;
        date_from?: string | null;
        date_to?: string | null;
    };

    const result = await runRatingsManualRecalculate({
        admin: getServiceClient() as never,
        userId: user.id,
        body,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse(result.data);
}

