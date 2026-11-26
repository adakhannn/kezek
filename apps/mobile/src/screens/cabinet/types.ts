import type {
    ClientBookingListItemDto,
    ClientBookingPackageDto,
    ClientBookingPromotionDto,
    ClientBookingReviewDto,
    ClientBookingServiceDto,
} from '@shared-client/types';

import type { Locale } from '../../i18n';
import { getServiceName } from '../../utils/i18n';

export type Booking = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    service: {
        name_ru: string;
        name_ky?: string | null;
        name_en?: string | null;
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
    /** All services of a multi-service booking (C11), with their ky/en names; empty for older servers and caches. */
    services?: ClientBookingServiceDto[];
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
                  name_ky: b.service.name_ky ?? null,
                  name_en: b.service.name_en ?? null,
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
        services: b.services ?? [],
        promotion: b.promotion ?? null,
        package: b.package ?? null,
        review: b.review ?? null,
        canReview: !!b.can_review,
    };
}

/** The card title in the app language: all services of a multi-service booking, else the main service. */
export function bookingTitle(booking: Booking, locale: Locale): string | null {
    const names = (booking.services ?? []).map((item) => getServiceName(item, locale)).filter(Boolean);
    if (names.length > 1) return names.join(' + ');
    return getServiceName(booking.service, locale) || null;
}
