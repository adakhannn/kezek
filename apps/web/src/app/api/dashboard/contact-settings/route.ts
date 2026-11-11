export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import {
    type BusinessContactSettingsAdminLike,
    updateBusinessContactSettings,
} from '@/lib/businessContactSettingsService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { isBusinessOwner } from '@/lib/staffApplicationApprovalService';
import { getServiceClient } from '@/lib/supabaseService';
import { validateRequest } from '@/lib/validation/apiValidation';
import { publicContactPatchSchema } from '@/lib/validation/businessUpdateSchemas';

export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.normal, () =>
        withErrorHandler('BusinessContactSettings', async () => {
            const { supabase, userId, bizId } = await getBizContextForManagers();
            const admin = getServiceClient();
            const [{ data: isSuper }, owner] = await Promise.all([
                supabase.rpc('is_super_admin'),
                isBusinessOwner({ admin: admin as never, userId, bizId }),
            ]);

            if (!isSuper && !owner) {
                return createErrorResponse(
                    'forbidden',
                    'Только владелец бизнеса может изменять публичные контакты',
                    undefined,
                    403,
                );
            }

            const validation = await validateRequest(req, publicContactPatchSchema);
            if (!validation.success) return validation.response;
            const result = await updateBusinessContactSettings({
                admin: admin as unknown as BusinessContactSettingsAdminLike,
                bizId,
                input: validation.data,
            });

            if (!result.ok) {
                return createErrorResponse(
                    result.error,
                    result.message,
                    'field' in result ? { field: result.field } : undefined,
                    result.status,
                );
            }

            return createSuccessResponse(result.data);
        }),
        "/api/dashboard/contact-settings",
    );
}
