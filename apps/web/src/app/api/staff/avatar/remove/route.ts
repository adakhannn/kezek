// apps/web/src/app/api/staff/avatar/remove/route.ts
import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffAvatarRemoveHttp } from '@/lib/staffAvatarRemoveHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: Request) {
    return withErrorHandler('StaffAvatarRemove', async () => runStaffAvatarRemoveHttp());
}

