import type { ClientBookingListItemDto } from '@shared-client/types';
import { isClientActiveBookingStatus, isClientPastBookingStatus } from '@core-domain/booking';

import type { OfflineBooking } from '../../lib/offlineBookingsStorage';
import type { Booking } from './types';

export function mapApiBookingToBooking(dto: ClientBookingListItemDto): Booking {
    return {
        id: dto.id,
        start_at: dto.start_at,
        end_at: dto.end_at,
        status: dto.status,
        service: dto.service ? { name_ru: dto.service.name_ru ?? '' } : null,
        staff: dto.staff ? { full_name: dto.staff.full_name ?? '' } : null,
        branch: dto.branch ? { name: dto.branch.name ?? '', address: dto.branch.address ?? '' } : null,
        business: dto.business ? { name: dto.business.name ?? '' } : null,
    };
}

export function mapBookingToOfflineBooking(booking: ClientBookingListItemDto, createdAt: string): OfflineBooking {
    return {
        id: String(booking.id),
        status: booking.status as OfflineBooking['status'],
        start_at: String(booking.start_at),
        end_at: String(booking.end_at),
        branch_name: booking.branch?.name ?? null,
        service_name: booking.service?.name_ru ?? null,
        staff_name: booking.staff?.full_name ?? null,
        business_name: booking.business?.name ?? null,
        created_at: createdAt,
    };
}

export function mapOfflineBookingToBooking(item: OfflineBooking): Booking {
    return {
        id: item.id,
        start_at: item.start_at,
        end_at: item.end_at,
        status: item.status,
        service: item.service_name ? { name_ru: item.service_name } : null,
        staff: item.staff_name ? { full_name: item.staff_name } : null,
        branch: item.branch_name ? { name: item.branch_name, address: '' } : null,
        business: item.business_name ? { name: item.business_name } : null,
    };
}

export function getUpcomingBookings(bookings: Booking[], now: Date): Booking[] {
    return bookings.filter((booking) => {
        if (!isClientActiveBookingStatus(booking.status as 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show')) {
            return false;
        }

        return new Date(booking.end_at) >= now;
    });
}

export function getPastBookings(bookings: Booking[], now: Date): Booking[] {
    return bookings.filter((booking) => {
        const end = new Date(booking.end_at);
        return (
            end < now ||
            isClientPastBookingStatus(booking.status as 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show')
        );
    });
}
