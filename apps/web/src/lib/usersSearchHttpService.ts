import { NextResponse } from 'next/server';

import { createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { runUsersSearch } from '@/lib/usersSearchService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { usersSearchSchema } from '@/lib/validation/schemas';

export async function runUsersSearchHttp(req: Request): Promise<NextResponse> {
    const { supabase, bizId } = await getBizContextForManagers();

    const validationResult = await validateRequest(req, usersSearchSchema);
    if (!validationResult.success) {
        return validationResult.response;
    }

    const result = await runUsersSearch({
        supabase,
        bizId,
        input: validationResult.data,
    });

    return createSuccessResponse(undefined, result);
}
