// apps/web/src/app/api/staff/avatar/upload/route.ts
import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffAvatarUploadHttp } from '@/lib/staffAvatarUploadHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    return withErrorHandler('StaffAvatarUpload', async () => runStaffAvatarUploadHttp(req));
}

