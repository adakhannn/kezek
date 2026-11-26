import type {
    ClientBookingListItemDto,
    ClientBookingPackageDto,
    ClientBookingPromotionDto,
    ClientBookingReviewDto,
} from '@shared-client/types';

export type Booking = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    service: {
        name_ru: string;
    } | null;
    staff: {
        full_name: string;
    } | null;
    branch: {
        name: string;
        address: string;
    } | null;
    business: {
        name: string;
        /** businesses.tz; missing from older servers and old offline caches (Asia/Bishkek then). */
        tz?: string | null;
    } | null;
    /** Names of all services of a multi-service booking (C11); empty for older servers and caches. */
    serviceNames?: string[];
    promotion?: ClientBookingPromotionDto | null;
    package?: ClientBookingPackageDto | null;
    review?: ClientBookingReviewDto | null;
    canReview?: boolean;
};

export function mapClientBookingListItemToBooking(b: ClientBookingListItemDto): Booking {
    return {
        id: b.id,
        start_at: b.start_at,
        end_at: b.end_at,
        status: b.status,
        service: b.service
            ? {
                  name_ru: b.service.name_ru ?? '',
              }
            : null,
        staff: b.staff
            ? {
                  full_name: b.staff.full_name ?? '',
              }
            : null,
        branch: b.branch
            ? {
                  name: b.branch.name ?? '',
                  address: b.branch.address ?? '',
              }
            : null,
        business: b.business
            ? {
                  name: b.business.name ?? '',
                  tz: b.business.tz ?? null,
              }
            : null,
        serviceNames: (b.services ?? []).map((item) => item.name_ru).filter(Boolean),
        promotion: b.promotion ?? null,
        package: b.package ?? null,
        review: b.review ?? null,
        canReview: !!b.can_review,
    };
}

/** The card title: all services of a multi-service booking, else the main service. */
export function bookingTitle(booking: Booking): string | null {
    if (booking.serviceNames && booking.serviceNames.length > 1) return booking.serviceNames.join(' + ');
    return booking.service?.name_ru || null;
}
