import { NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getStaffContext } from '@/lib/authBiz';
import { runStaffAvatarUpload } from '@/lib/staffAvatarUploadService';
import { getServiceClient } from '@/lib/supabaseService';

export async function runStaffAvatarUploadHttp(req: Request): Promise<NextResponse> {
    const { staffId, bizId } = await getStaffContext();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    const admin = getServiceClient();
    const result = await runStaffAvatarUpload({
        admin,
        staffId,
        bizId,
        file,
    });

    if (!result.ok) {
        return createErrorResponse(result.error, result.message, result.details, result.status);
    }

    return createSuccessResponse(result.data);
}
