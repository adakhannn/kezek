import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { listMobileCategories } from '@/lib/mobileCategoriesService';
import { createSupabaseAnonClient } from '@/lib/supabaseHelpers';

export async function runMobileCategoriesHttp(): Promise<NextResponse> {
    const result = await listMobileCategories(createSupabaseAnonClient());
    if (!result.ok) return createErrorResponse(result.error, result.message, undefined, result.status);
    return createSuccessResponse(result.data);
}
