import { z } from 'zod';

import { createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { listDashboardBookingClientIdentities } from '@/lib/dashboardBookingClientIdentityService';
import { getServiceClient } from '@/lib/supabaseService';
import { validateRequest } from '@/lib/validation/apiValidation';

const schema = z.object({ bookingIds: z.array(z.string().uuid()).max(30) }).strict();

export async function runDashboardBookingClientIdentityHttp(req: Request) {
    const { supabase, bizId } = await getBizContextForManagers();
    const input = await validateRequest(req, schema);
    if (!input.success) return input.response;
    const identities = await listDashboardBookingClientIdentities({
        supabase, admin: getServiceClient(), bizId, bookingIds: input.data.bookingIds,
    });
    return createSuccessResponse(undefined, { identities });
}
