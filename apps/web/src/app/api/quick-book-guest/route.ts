import { createClient } from '@supabase/supabase-js';

import { createBookingNotificationHttpAdapter } from '../_shared/bookingNotificationHttpAdapter';

import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { validateRequest } from '@/lib/validation/apiValidation';
import { quickBookGuestSchema } from '@/lib/validation/bookingSchemas';

import { createGuestBookingApplication } from './createGuestBookingApplication';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.public, async () => {
        return withErrorHandler('QuickBookGuest', async () => {
            const url = getSupabaseUrl();
            const anon = getSupabaseAnonKey();
            const supabase = createClient(url, anon, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
            });

            const validationResult = await validateRequest(req, quickBookGuestSchema);
            if (!validationResult.success) {
                return validationResult.response;
            }

            const result = await createGuestBookingApplication(
                {
                    supabase,
                    notifications: createBookingNotificationHttpAdapter(req, 'QuickBookGuest'),
                },
                validationResult.data,
            );

            if (!result.ok) {
                return createErrorResponse('validation', result.message, { code: result.code }, 400);
            }

            return createSuccessResponse({
                booking_id: result.bookingId,
                confirmed: result.confirmed,
            });
        });
    });
}
