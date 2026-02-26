// apps/web/src/app/api/mobile/bookings/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { ClientBookingListItemDto } from '@shared-client/types';
import { createClient } from '@supabase/supabase-js';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { logDebug, logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

type BookingListService = {
    name_ru: string | null;
};

type BookingListStaff = {
    full_name: string | null;
};

type BookingListBranch = {
    name: string | null;
    address: string | null;
};

type BookingListBusiness = {
    name: string | null;
    slug: string | null;
};

type BookingListRow = {
    id: string | number;
    start_at: string;
    end_at: string;
    status: ClientBookingListItemDto['status'];
    service: BookingListService | BookingListService[] | null;
    staff: BookingListStaff | BookingListStaff[] | null;
    branch: BookingListBranch | BookingListBranch[] | null;
    business: BookingListBusiness | BookingListBusiness[] | null;
};

function toSingle<T>(value: T | T[] | null): T | null {
    if (!value) return null;
    return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () =>
            withErrorHandler('MobileBookingsList', async () => {
                const supabaseUrl = getSupabaseUrl();
                const anonKey = getSupabaseAnonKey();

                const authHeader = req.headers.get('Authorization');
                const bearerToken = authHeader?.startsWith('Bearer ')
                    ? authHeader.substring(7)
                    : null;

                let supabase;
                let user;

                if (bearerToken) {
                    // Мобильное приложение — используем токен из заголовка
                    supabase = createClient(supabaseUrl, anonKey, {
                        global: {
                            headers: {
                                Authorization: `Bearer ${bearerToken}`,
                            },
                        },
                        auth: {
                            persistSession: false,
                            autoRefreshToken: false,
                        },
                    });
                    const {
                        data: { user: userData },
                        error: userError,
                    } = await supabase.auth.getUser();
                    if (userError || !userData) {
                        logError('MobileBookingsList', 'Bearer token auth failed', {
                            error: userError?.message || 'No user',
                            hasToken: !!bearerToken,
                            tokenLength: bearerToken?.length,
                        });
                        return createErrorResponse('auth', 'Not signed in', undefined, 401);
                    }
                    user = userData;
                    logDebug('MobileBookingsList', 'Bearer token auth successful', {
                        userId: user.id,
                    });
                } else {
                    // Веб-клиент — используем cookies
                    supabase = await createSupabaseServerClient();
                    const {
                        data: { user: userData },
                    } = await supabase.auth.getUser();
                    if (!userData) {
                        return createErrorResponse('auth', 'Not signed in', undefined, 401);
                    }
                    user = userData;
                }

                const { data, error } = await supabase
                    .from('bookings')
                    .select(
                        `
                        id,
                        start_at,
                        end_at,
                        status,
                        service:services(name_ru),
                        staff:staff(full_name),
                        branch:branches(name,address),
                        business:businesses(name,slug)
                    `,
                    )
                    .eq('client_id', user.id)
                    .order('start_at', { ascending: false })
                    .limit(50);

                if (error) {
                    logError('MobileBookingsList', 'Error fetching bookings', error);
                    return createErrorResponse('internal', 'Не удалось загрузить бронирования', error.message, 500);
                }

                const rows = (data ?? []) as BookingListRow[];

                const items: ClientBookingListItemDto[] = rows.map((b) => {
                    const service = toSingle(b.service);
                    const staff = toSingle(b.staff);
                    const branch = toSingle(b.branch);
                    const business = toSingle(b.business);

                    return {
                        id: String(b.id),
                        start_at: String(b.start_at),
                        end_at: String(b.end_at),
                        status: b.status,
                        service: service
                            ? {
                                  name_ru: service.name_ru ?? null,
                              }
                            : null,
                        staff: staff
                            ? {
                                  full_name: staff.full_name ?? null,
                              }
                            : null,
                        branch: branch
                            ? {
                                  name: branch.name ?? null,
                                  address: branch.address ?? null,
                              }
                            : null,
                        business: business
                            ? {
                                  name: business.name ?? null,
                                  slug: business.slug ?? null,
                              }
                            : null,
                    };
                });

                return createSuccessResponse(items);
            }),
    );
}

