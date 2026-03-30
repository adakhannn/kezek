import { NextResponse } from 'next/server';

import {
    createErrorResponse,
    createSuccessResponse,
} from '@/lib/apiErrorHandler';
import { createSupabaseClients } from '@/lib/supabaseHelpers';
import { runUserUpdatePhone } from '@/lib/userUpdatePhoneService';

export async function runUserUpdatePhoneHttp(req: Request): Promise<NextResponse> {
    const { supabase, admin } = await createSupabaseClients();
    const body = await req.json();

    const result = await runUserUpdatePhone({
        supabase,
        admin,
        phone: body?.phone,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, undefined, result.status);
    }

    return createSuccessResponse();
}
