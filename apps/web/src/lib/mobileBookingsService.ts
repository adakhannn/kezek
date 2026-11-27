import { resolveBusinessTimeZone } from '@shared-client/timezone';
import type {
    BookingDetailsViewerRole,
    ClientBookingDetailsDto,
    ClientBookingListItemDto,
    ClientBookingPackageDto,
    ClientBookingPromotionDto,
    ClientBookingReviewDto,
    ClientBookingServiceDto,
    ClientBookingsPageDto,
} from '@shared-client/types';

import { reportDatabaseError } from '@/lib/apiErrorHandler';
import { bookingCancellationError } from '@/lib/bookingCancellationError';
import type { DbQueryClient } from '@/lib/supabaseTypes';

type BookingListService = {
    name_ru: string | null;
    name_ky?: string | null;
    name_en?: string | null;
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
    tz?: string | null;
};

type BookingServiceLine = {
    order_index?: number | null;
    duration_min?: number | null;
    service:
        | { name_ru: string | null; name_ky?: string | null; name_en?: string | null; duration_min?: number | null }
        | Array<{ name_ru: string | null; name_ky?: string | null; name_en?: string | null; duration_min?: number | null }>
        | null;
};

type BookingReviewRow = {
    id: string;
    rating: number;
    comment: string | null;
};

type BookingListRow = {
    id: string | number;
    start_at: string;
    end_at: string;
    status: ClientBookingListItemDto['status'];
    promotion_applied?: unknown;
    subscription_applied?: unknown;
    service: BookingListService | BookingListService[] | null;
    booking_services?: BookingServiceLine[] | null;
    staff: BookingListStaff | BookingListStaff[] | null;
    branch: BookingListBranch | BookingListBranch[] | null;
    business: BookingListBusiness | BookingListBusiness[] | null;
    reviews?: BookingReviewRow | BookingReviewRow[] | null;
};

type BookingDetailsService = {
    name_ru: string | null;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number | null;
    price_from: number | null;
    price_to: number | null;
};

type BookingDetailsStaff = {
    full_name: string | null;
    user_id?: string | null;
    is_active?: boolean | null;
};

type BookingDetailsBranch = {
    name: string | null;
    address: string | null;
    lat?: number | null;
    lon?: number | null;
};

type BookingDetailsBusiness = {
    name: string | null;
    slug: string | null;
    phones: string[] | null;
    tz?: string | null;
};

type BookingDetailsRow = {
    id: string | number;
    biz_id?: string | null;
    branch_id?: string | null;
    staff_id?: string | null;
    client_id?: string | null;
    client_name?: string | null;
    promotion_applied?: unknown;
    subscription_applied?: unknown;
    start_at: string;
    end_at: string;
    status: ClientBookingDetailsDto['status'];
    service: BookingDetailsService | BookingDetailsService[] | null;
    booking_services?: BookingServiceLine[] | null;
    staff: BookingDetailsStaff | BookingDetailsStaff[] | null;
    branch: BookingDetailsBranch | BookingDetailsBranch[] | null;
    business: BookingDetailsBusiness | BookingDetailsBusiness[] | null;
    reviews?: BookingReviewRow | BookingReviewRow[] | null;
};

type MobileBookingsClient = DbQueryClient;

type ServiceFailure = {
    ok: false;
    error: 'internal' | 'not_found' | 'forbidden' | 'financial_reversal_required' | 'not_cancellable' | 'booking_already_started' | 'booking_changed';
    message: string;
    details?: unknown;
    status: 403 | 404 | 409 | 500;
};

export const MOBILE_BOOKINGS_DEFAULT_LIMIT = 50;
export const MOBILE_BOOKINGS_MAX_LIMIT = 100;

function toSingle<T>(value: T | T[] | null | undefined): T | null {
    if (!value) return null;
    return Array.isArray(value) ? value[0] ?? null : value;
}

function toNumberOrNull(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function toTextOrNull(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Kyrgyz/English titles of applied promotions by branch_promotions.id. */
export type PromotionTitles = Map<string, { title_ky: string | null; title_en: string | null }>;

function appliedPromotionId(value: unknown): string | null {
    const id = asRecord(value)?.promotion_id;
    if (typeof id === 'number' && Number.isFinite(id)) return String(id);
    return toTextOrNull(id);
}

/**
 * C6: promotion_applied records only the Russian title, so the Kyrgyz and English ones come from
 * branch_promotions. RLS limits the read to active promotions (and the caller's own business); an
 * unreadable promotion or a failed read keeps the recorded Russian title, never fails the answer.
 */
export async function loadPromotionTitles(client: MobileBookingsClient, values: unknown[]): Promise<PromotionTitles> {
    const titles: PromotionTitles = new Map();
    const ids = [...new Set(values.map(appliedPromotionId).filter((id): id is string => id !== null))];
    if (ids.length === 0) return titles;
    try {
        const { data, error } = await client.from('branch_promotions').select('id, title_ky, title_en').in('id', ids);
        if (error || !Array.isArray(data)) return titles;
        for (const row of data as Array<{ id: unknown; title_ky?: unknown; title_en?: unknown }>) {
            titles.set(String(row.id), { title_ky: toTextOrNull(row.title_ky), title_en: toTextOrNull(row.title_en) });
        }
    } catch {
        // Localized titles are optional: the recorded Russian title stays.
    }
    return titles;
}

/** bookings.promotion_applied as the web cabinet shows it (title, discount, final amount). */
export function mapAppliedPromotion(value: unknown, titles?: PromotionTitles): ClientBookingPromotionDto | null {
    const record = asRecord(value);
    if (!record) return null;
    const promotionId = appliedPromotionId(record);
    const localized = promotionId ? titles?.get(promotionId) : undefined;
    return {
        title: toTextOrNull(record.promotion_title) ?? toTextOrNull(record.promotion_type),
        discount_percent: toNumberOrNull(record.discount_percent),
        final_amount: toNumberOrNull(record.final_amount),
        ...(localized ? { title_ky: localized.title_ky, title_en: localized.title_en } : {}),
    };
}

/** bookings.subscription_applied: the visit is paid with a package. */
export function mapAppliedPackage(value: unknown): ClientBookingPackageDto | null {
    const record = asRecord(value);
    if (!record) return null;
    return {
        name: toTextOrNull(record.plan_name_ru) ?? toTextOrNull(record.promotion_title),
        final_amount: toNumberOrNull(record.final_amount),
    };
}

/** booking_services in booking order; empty when the booking has none (older single-service rows). */
export function mapBookingServices(lines: BookingServiceLine[] | null | undefined): ClientBookingServiceDto[] {
    return [...(lines ?? [])]
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((line) => {
            const service = toSingle(line.service);
            return {
                name_ru: service?.name_ru ?? '',
                name_ky: service?.name_ky ?? null,
                name_en: service?.name_en ?? null,
                duration_min: line.duration_min ?? service?.duration_min ?? null,
            };
        })
        .filter((line) => line.name_ru !== '' || !!line.name_ky || !!line.name_en);
}

function mapReview(value: BookingReviewRow | BookingReviewRow[] | null | undefined): ClientBookingReviewDto | null {
    const review = toSingle(value);
    if (!review?.id) return null;
    return { id: String(review.id), rating: Number(review.rating), comment: review.comment ?? null };
}

/** Same rule as POST /api/reviews/create and public.can_review: paid, visit started, no review yet. */
export function canLeaveReview(
    row: { status: string; start_at: string },
    review: ClientBookingReviewDto | null,
    now: Date,
): boolean {
    if (review) return false;
    const startAt = new Date(row.start_at).getTime();
    return row.status === 'paid' && Number.isFinite(startAt) && startAt <= now.getTime();
}

/** limit 1..100 (default 50) and offset >= 0 from the query string; anything else is the default. */
export function parseMobileBookingsPage(searchParams: URLSearchParams): { limit: number; offset: number } {
    const rawLimit = Number.parseInt(searchParams.get('limit') ?? '', 10);
    const rawOffset = Number.parseInt(searchParams.get('offset') ?? '', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, MOBILE_BOOKINGS_MAX_LIMIT)
        : MOBILE_BOOKINGS_DEFAULT_LIMIT;
    const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;
    return { limit, offset };
}

export async function listMobileBookings({
    client,
    userId,
    limit = MOBILE_BOOKINGS_DEFAULT_LIMIT,
    offset = 0,
    now = new Date(),
}: {
    client: MobileBookingsClient;
    userId: string;
    limit?: number;
    offset?: number;
    now?: Date;
}): Promise<{ ok: true; data: ClientBookingListItemDto[]; page: ClientBookingsPageDto } | ServiceFailure> {
    // One row beyond the page tells whether another page exists (B11: history was capped at 50).
    const { data, error } = await client
        .from('bookings')
        .select(
            `
                        id,
                        start_at,
                        end_at,
                        status,
                        promotion_applied,
                        subscription_applied,
                        service:services(name_ru, name_ky, name_en),
                        booking_services(order_index, duration_min, service:services(name_ru, name_ky, name_en, duration_min)),
                        staff:staff(full_name),
                        branch:branches(name,address),
                        business:businesses(name,slug,tz),
                        reviews:reviews(id, rating, comment)
                    `,
        )
        .eq('client_id', userId)
        .order('start_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + limit);

    if (error) {
        return {
            ok: false,
            error: 'internal',
            message: reportDatabaseError('MobileBookings', error, 'Не удалось загрузить бронирования'),
            status: 500,
        };
    }

    const allRows = (data ?? []) as BookingListRow[];
    const hasMore = allRows.length > limit;
    const rows = hasMore ? allRows.slice(0, limit) : allRows;
    const promotionTitles = await loadPromotionTitles(client, rows.map((row) => row.promotion_applied));

    return {
        ok: true,
        page: {
            offset,
            limit,
            has_more: hasMore,
            next_offset: hasMore ? offset + limit : null,
        },
        data: rows.map((booking) => {
            const service = toSingle(booking.service);
            const staff = toSingle(booking.staff);
            const branch = toSingle(booking.branch);
            const business = toSingle(booking.business);
            const review = mapReview(booking.reviews);
            const services = mapBookingServices(booking.booking_services);

            return {
                id: String(booking.id),
                start_at: String(booking.start_at),
                end_at: String(booking.end_at),
                status: booking.status,
                service: service
                    ? {
                          name_ru: service.name_ru ?? null,
                          name_ky: service.name_ky ?? null,
                          name_en: service.name_en ?? null,
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
                          tz: resolveBusinessTimeZone(business.tz),
                      }
                    : null,
                ...(services.length > 0 ? { services } : {}),
                promotion: mapAppliedPromotion(booking.promotion_applied, promotionTitles),
                package: mapAppliedPackage(booking.subscription_applied),
                review,
                can_review: canLeaveReview(booking, review, now),
            };
        }),
    };
}

/**
 * Who may read the booking (B1): its client; its own master while active (the confirm and cancel
 * pushes open this screen); an owner, admin or manager of the business. RLS already limits the
 * read to these; the explicit rule keeps a wider policy from widening this endpoint.
 */
async function resolveDetailsViewer(
    row: BookingDetailsRow,
    userId: string,
    isBusinessManager?: (bizId: string) => Promise<boolean>,
): Promise<BookingDetailsViewerRole | null> {
    if (row.client_id && row.client_id === userId) return 'client';
    const staff = toSingle(row.staff);
    if (staff?.user_id && staff.user_id === userId && staff.is_active !== false) return 'staff';
    if (row.biz_id && isBusinessManager && (await isBusinessManager(row.biz_id))) return 'manager';
    return null;
}

export async function getMobileBookingDetails({
    client,
    userId,
    bookingId,
    isBusinessManager,
    now = new Date(),
}: {
    client: MobileBookingsClient;
    userId: string;
    bookingId: string;
    /** Owner, admin or manager of the business (businessManagerAccess); without it only client and master read. */
    isBusinessManager?: (bizId: string) => Promise<boolean>;
    now?: Date;
}): Promise<{ ok: true; data: ClientBookingDetailsDto } | ServiceFailure> {
    const { data, error } = await client
        .from('bookings')
        .select(
            `
                        id,
                        start_at,
                        end_at,
                        status,
                        biz_id,
                        branch_id,
                        staff_id,
                        client_id,
                        client_name,
                        promotion_applied,
                        subscription_applied,
                        service:services(name_ru, name_ky, name_en, duration_min, price_from, price_to),
                        booking_services(order_index, duration_min, service:services(name_ru, name_ky, name_en, duration_min)),
                        staff:staff(full_name, user_id, is_active),
                        branch:branches(name, address, lat, lon),
                        business:businesses(name, slug, phones, tz),
                        reviews:reviews(id, rating, comment)
                    `,
        )
        .eq('id', bookingId)
        .maybeSingle();

    const loadFailed = (cause: unknown): ServiceFailure => ({
        ok: false,
        error: 'internal',
        message: reportDatabaseError('MobileBookings', cause, 'Не удалось загрузить бронирование'),
        status: 500,
    });

    if (error) {
        return loadFailed(error);
    }

    const notFound: ServiceFailure = {
        ok: false,
        error: 'not_found',
        message: 'Бронирование не найдено',
        status: 404,
    };

    if (!data) {
        return notFound;
    }

    const row = data as BookingDetailsRow;
    let viewerRole: BookingDetailsViewerRole | null;
    try {
        viewerRole = await resolveDetailsViewer(row, userId, isBusinessManager);
    } catch (accessError) {
        return loadFailed(accessError);
    }
    // Someone else's booking reads as absent: its existence is not disclosed.
    if (!viewerRole) {
        return notFound;
    }

    const isClient = viewerRole === 'client';
    const service = toSingle(row.service);
    const staff = toSingle(row.staff);
    const branch = toSingle(row.branch);
    const business = toSingle(row.business);
    const services = mapBookingServices(row.booking_services);
    const review = isClient ? mapReview(row.reviews) : null;
    const promotionTitles = await loadPromotionTitles(client, [row.promotion_applied]);

    return {
        ok: true,
        data: {
            id: String(row.id),
            start_at: String(row.start_at),
            end_at: String(row.end_at),
            status: row.status,
            viewer_role: viewerRole,
            ...(row.biz_id ? { biz_id: row.biz_id } : {}),
            ...(row.branch_id ? { branch_id: row.branch_id } : {}),
            ...(row.staff_id ? { staff_id: row.staff_id } : {}),
            benefit_applied: row.promotion_applied != null || row.subscription_applied != null,
            service: service
                ? {
                      name_ru: service.name_ru ?? '',
                      name_ky: service.name_ky ?? null,
                      name_en: service.name_en ?? null,
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
            ...(services.length > 0 ? { services } : {}),
            promotion: mapAppliedPromotion(row.promotion_applied, promotionTitles),
            package: mapAppliedPackage(row.subscription_applied),
            staff: staff
                ? {
                      full_name: staff.full_name ?? '',
                  }
                : null,
            branch: branch
                ? {
                      name: branch.name ?? '',
                      address: branch.address ?? null,
                      lat: toNumberOrNull(branch.lat),
                      lon: toNumberOrNull(branch.lon),
                  }
                : null,
            business: business
                ? {
                      name: business.name ?? '',
                      slug: business.slug ?? undefined,
                      phones: Array.isArray(business.phones) ? business.phones : business.phones ?? [],
                      tz: resolveBusinessTimeZone(business.tz),
                  }
                : null,
            // The client's own view carries the review; staff see the client's name only, as on the
            // staff screens, and no contacts.
            ...(isClient
                ? { review, can_review: canLeaveReview(row, review, now) }
                : { can_review: false, client_name: row.client_name ?? null }),
        },
    };
}

export async function cancelMobileBooking({
    client,
    userId,
    bookingId,
}: {
    client: MobileBookingsClient;
    userId: string;
    bookingId: string;
}): Promise<{ ok: true; alreadyCancelled?: boolean } | ServiceFailure> {
    const { data: booking, error: readError } = await client
        .from('bookings')
        .select('id, status')
        .eq('id', bookingId)
        .eq('client_id', userId)
        .maybeSingle();

    if (readError) {
        return {
            ok: false,
            error: 'internal',
            message: reportDatabaseError('MobileBookings', readError, 'Не удалось загрузить бронирование'),
            status: 500,
        };
    }

    if (!booking) {
        return {
            ok: false,
            error: 'not_found',
            message: 'Бронирование не найдено',
            status: 404,
        };
    }

    if (booking.status === 'cancelled') {
        return {
            ok: true,
            alreadyCancelled: true,
        };
    }

    const { error: updateError } = await client.rpc('cancel_booking', { p_booking_id: bookingId });

    if (updateError) {
        const conflict = bookingCancellationError(updateError);
        if (conflict) return conflict;
        return {
            ok: false,
            error: 'internal',
            message: reportDatabaseError('MobileBookings', updateError, 'Не удалось отменить бронирование'),
            status: 500,
        };
    }

    return { ok: true };
}
