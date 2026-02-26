// apps/web/src/app/api/mobile/bookings/[id]/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import type { ClientBookingDetailsDto } from '@shared-client/types';
import { createClient } from '@supabase/supabase-js';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { logError } from '@/lib/log';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { getRouteParamUuid } from '@/lib/routeParams';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

type BookingDetailsService = {
    name_ru: string | null;
    duration_min: number | null;
    price_from: number | null;
    price_to: number | null;
};

type BookingDetailsStaff = {
    full_name: string | null;
};

type BookingDetailsBranch = {
    name: string | null;
    address: string | null;
};

type BookingDetailsBusiness = {
    name: string | null;
    slug: string | null;
    phones: string[] | null;
};

type BookingDetailsRow = {
    id: string | number;
    start_at: string;
    end_at: string;
    status: ClientBookingDetailsDto['status'];
    service: BookingDetailsService | BookingDetailsService[] | null;
    staff: BookingDetailsStaff | BookingDetailsStaff[] | null;
    branch: BookingDetailsBranch | BookingDetailsBranch[] | null;
    business: BookingDetailsBusiness | BookingDetailsBusiness[] | null;
};

function toSingle<T>(value: T | T[] | null): T | null {
    if (!value) return null;
    return Array.isArray(value) ? value[0] ?? null : value;
}

export async function GET(req: Request, context: unknown) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () =>
            withErrorHandler('MobileBookingDetails', async () => {
                const bookingId = await getRouteParamUuid(context, 'id');

                const supabaseUrl = getSupabaseUrl();
                const anonKey = getSupabaseAnonKey();

                const authHeader = req.headers.get('Authorization');
                const bearerToken = authHeader?.startsWith('Bearer ')
                    ? authHeader.substring(7)
                    : null;

                let supabase;
                let user;

                if (bearerToken) {
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
                        return createErrorResponse('auth', 'Not signed in', undefined, 401);
                    }
                    user = userData;
                } else {
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
                        service:services(name_ru, duration_min, price_from, price_to),
                        staff:staff(full_name),
                        branch:branches(name, address),
                        business:businesses(name, slug, phones)
                    `,
                    )
                    .eq('id', bookingId)
                    .eq('client_id', user.id)
                    .maybeSingle();

                if (error) {
                    logError('MobileBookingDetails', 'Error fetching booking', error);
                    return createErrorResponse('internal', 'Не удалось загрузить бронирование', error.message, 500);
                }

                if (!data) {
                    return createErrorResponse('not_found', 'Бронирование не найдено', undefined, 404);
                }

                const row = data as BookingDetailsRow;

                const service = toSingle(row.service);
                const staff = toSingle(row.staff);
                const branch = toSingle(row.branch);
                const business = toSingle(row.business);

                const dto: ClientBookingDetailsDto = {
                    id: String(row.id),
                    start_at: String(row.start_at),
                    end_at: String(row.end_at),
                    status: row.status,
                    service: service
                        ? {
                              name_ru: service.name_ru ?? '',
                              duration_min: service.duration_min ?? 0,
                              price_from:
                                  typeof service.price_from === 'number'
                                      ? service.price_from
                                      : service.price_from ?? null,
                              price_to:
                                  typeof service.price_to === 'number'
                                      ? service.price_to
                                      : service.price_to ?? null,
                          }
                        : null,
                    staff: staff
                        ? {
                              full_name: staff.full_name ?? '',
                          }
                        : null,
                    branch: branch
                        ? {
                              name: branch.name ?? '',
                              address: branch.address ?? null,
                          }
                        : null,
                    business: business
                        ? {
                              name: business.name ?? '',
                              slug: business.slug ?? undefined,
                              phones: Array.isArray(business.phones)
                                  ? business.phones
                                  : business.phones ?? [],
                          }
                        : null,
                };

                return createSuccessResponse(dto);
            }),
    );
}

