import type { ClientBookingListItemDto } from '@shared-client/types';

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
    } | null;
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
              }
            : null,
    };
}
