// apps/web/src/lib/notifications/BookingDataService.ts

import { type SupabaseClient } from '@supabase/supabase-js';

import type { BookingRow } from './types';

import { logDebug, logError } from '@/lib/log';

/**
 * Сервис для получения данных бронирования
 * Инкапсулирует логику получения данных бронирования из базы данных
 */
export class BookingDataService {
    constructor(
        private admin: SupabaseClient
    ) {}

    /**
     * Получает полные данные бронирования по ID
     * Включает связанные данные: услуги, мастера, бизнес, филиал
     */
    async getBookingById(bookingId: string): Promise<BookingRow | null> {
        logDebug('BookingDataService', 'Fetching booking data', { booking_id: bookingId });

        const { data: booking, error: bookingError } = await this.admin
            .from('bookings')
            .select(`
                id, status, start_at, end_at, created_at, client_id, client_phone, client_name, client_email,
                services:services!bookings_service_id_fkey ( name_ru, duration_min, price_from, price_to ),
                staff:staff!bookings_staff_id_fkey ( full_name, email, phone, user_id ),
                biz:businesses!bookings_biz_id_fkey ( name, email_notify_to, slug, address, phones, owner_id ),
                branches:branches!bookings_branch_id_fkey ( name, address )
            `)
            .eq('id', bookingId)
            .maybeSingle<BookingRow>();

        if (bookingError) {
            logError('BookingDataService', 'Error fetching booking', {
                booking_id: bookingId,
                error: bookingError.message,
            });
            throw new Error(`Failed to fetch booking: ${bookingError.message}`);
        }

        if (!booking) {
            logDebug('BookingDataService', 'Booking not found', { booking_id: bookingId });
            return null;
        }

        logDebug('BookingDataService', 'Booking found', {
            booking_id: booking.id,
            status: booking.status,
        });

        return booking;
    }

    /**
     * Получает email владельца бизнеса по owner_id
     */
    async getOwnerEmail(ownerId: string): Promise<string | null> {
        logDebug('BookingDataService', 'Fetching owner email', { owner_id: ownerId });

        try {
            const { data: owner } = await this.admin.auth.admin.getUserById(ownerId);
            const email = owner?.user?.email ?? null;
            
            if (email) {
                logDebug('BookingDataService', 'Owner email found', { owner_id: ownerId, email });
            } else {
                logDebug('BookingDataService', 'Owner email not found', { owner_id: ownerId });
            }
            
            return email;
        } catch (e) {
            logError('BookingDataService', 'Failed to get owner email', {
                owner_id: ownerId,
                error: e instanceof Error ? e.message : String(e),
            });
            return null;
        }
    }

    /**
     * Получает email владельца из данных бизнеса
     * Если бизнес передан как массив, берет первый элемент
     */
    async getOwnerEmailFromBusiness(biz: BookingRow['biz']): Promise<string | null> {
        const business = Array.isArray(biz) ? biz[0] : biz;
        
        if (!business?.owner_id) {
            return null;
        }

        return this.getOwnerEmail(business.owner_id);
    }
}

