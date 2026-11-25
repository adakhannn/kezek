import { resolveBusinessTimeZone } from '@shared-client/timezone';
import type { ClientBookingDetailsDto, ClientBookingListItemDto } from '@shared-client/types';

import { bookingCancellationError } from '@/lib/bookingCancellationError';
import type { DbQueryClient } from '@/lib/supabaseTypes';

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
    tz?: string | null;
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
    tz?: string | null;
};

type BookingDetailsRow = {
    id: string | number;
    biz_id?: string | null;
    branch_id?: string | null;
    staff_id?: string | null;
    promotion_applied?: unknown;
    subscription_applied?: unknown;
    start_at: string;
    end_at: string;
    status: ClientBookingDetailsDto['status'];
    service: BookingDetailsService | BookingDetailsService[] | null;
    staff: BookingDetailsStaff | BookingDetailsStaff[] | null;
    branch: BookingDetailsBranch | BookingDetailsBranch[] | null;
    business: BookingDetailsBusiness | BookingDetailsBusiness[] | null;
};

type MobileBookingsClient = DbQueryClient;

type ServiceFailure = {
    ok: false;
    error: 'internal' | 'not_found' | 'forbidden' | 'financial_reversal_required' | 'not_cancellable' | 'booking_already_started' | 'booking_changed';
    message: string;
    details?: unknown;
    status: 403 | 404 | 409 | 500;
};

function toSingle<T>(value: T | T[] | null): T | null {
    if (!value) return null;
    return Array.isArray(value) ? value[0] ?? null : value;
}

export async function listMobileBookings({
    client,
    userId,
}: {
    client: MobileBookingsClient;
    userId: string;
}): Promise<{ ok: true; data: ClientBookingListItemDto[] } | ServiceFailure> {
    const { data, error } = await client
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
                        business:businesses(name,slug,tz)
                    `,
        )
        .eq('client_id', userId)
        .order('start_at', { ascending: false })
        .limit(50);

    if (error) {
        return {
            ok: false,
            error: 'internal',
            message: 'Не удалось загрузить бронирования',
            details: error.message,
            status: 500,
        };
    }

    const rows = (data ?? []) as BookingListRow[];

    return {
        ok: true,
        data: rows.map((booking) => {
            const service = toSingle(booking.service);
            const staff = toSingle(booking.staff);
            const branch = toSingle(booking.branch);
            const business = toSingle(booking.business);

            return {
                id: String(booking.id),
                start_at: String(booking.start_at),
                end_at: String(booking.end_at),
                status: booking.status,
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
                          tz: resolveBusinessTimeZone(business.tz),
                      }
                    : null,
            };
        }),
    };
}

export async function getMobileBookingDetails({
    client,
    userId,
    bookingId,
}: {
    client: MobileBookingsClient;
    userId: string;
    bookingId: string;
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
                        promotion_applied,
                        subscription_applied,
                        service:services(name_ru, duration_min, price_from, price_to),
                        staff:staff(full_name),
                        branch:branches(name, address),
                        business:businesses(name, slug, phones, tz)
                    `,
        )
        .eq('id', bookingId)
        .eq('client_id', userId)
        .maybeSingle();

    if (error) {
        return {
            ok: false,
            error: 'internal',
            message: 'Не удалось загрузить бронирование',
            details: error.message,
            status: 500,
        };
    }

    if (!data) {
        return {
            ok: false,
            error: 'not_found',
            message: 'Бронирование не найдено',
            status: 404,
        };
    }

    const row = data as BookingDetailsRow;
    const service = toSingle(row.service);
    const staff = toSingle(row.staff);
    const branch = toSingle(row.branch);
    const business = toSingle(row.business);

    return {
        ok: true,
        data: {
            id: String(row.id),
            start_at: String(row.start_at),
            end_at: String(row.end_at),
            status: row.status,
            ...(row.biz_id ? { biz_id: row.biz_id } : {}),
            ...(row.branch_id ? { branch_id: row.branch_id } : {}),
            ...(row.staff_id ? { staff_id: row.staff_id } : {}),
            benefit_applied: row.promotion_applied != null || row.subscription_applied != null,
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
                      phones: Array.isArray(business.phones) ? business.phones : business.phones ?? [],
                      tz: resolveBusinessTimeZone(business.tz),
                  }
                : null,
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
            message: 'Не удалось загрузить бронирование',
            details: readError.message,
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
            message: 'Не удалось отменить бронирование',
            details: updateError.message,
            status: 500,
        };
    }

    return { ok: true };
}
