import { formatInTimeZone } from 'date-fns-tz';
import { useRef, useState } from 'react';

import type { Service } from '../types';
import { fmtErr, withNetworkRetry } from '../utils';

import { trackFunnelEvent, getSessionId } from '@/lib/funnelEvents';
import { logDebug, logError } from '@/lib/log';
import { createQuickHoldBooking, QuickHoldClientError } from '@/lib/quickHoldClient';

type BookingFeedbackApi = {
    showError: (message: string, duration?: number) => string;
};

type UseBookingCreationParams = {
    bizId: string;
    /** The business time zone (businesses.tz) of the slot times. */
    businessTz: string;
    branchId: string;
    /** Одна или несколько услуг (комплекс); при одной вызывается hold_slot, при нескольких - hold_complex_slot */
    services: Service[];
    staffId: string;
    isAuthed: boolean;
    t: (key: string, fallback?: string) => string;
    onAuthChoiceRequest: (slotTime: Date, slotStaffId?: string) => void;
    onBookingCreated?: () => void;
    onSlotUnavailable?: () => void;
    feedback: BookingFeedbackApi;
};

export function useBookingCreation(params: UseBookingCreationParams) {
    const {
        bizId,
        businessTz,
        branchId,
        services,
        staffId,
        isAuthed,
        t,
        onAuthChoiceRequest,
        onBookingCreated,
        onSlotUnavailable,
        feedback,
    } = params;
    const [loading, setLoading] = useState(false);
    const inFlight = useRef(false);

    async function createBooking(slotTime: Date, slotStaffId?: string) {
        if (inFlight.current) return;
        if (!services.length) {
            feedback.showError(
                t(
                    'booking.selectService',
                    'Пожалуйста, выберите услугу перед продолжением.',
                ),
            );
            return;
        }

        let actualStaffId: string;
        if (staffId === 'any') {
            if (!slotStaffId) {
                feedback.showError(
                    t(
                        'booking.selectMaster',
                        'Не удалось определить мастера для выбранного времени. Пожалуйста, выберите время еще раз.',
                    ),
                );
                return;
            }
            actualStaffId = slotStaffId;
        } else {
            actualStaffId = staffId;
        }

        if (!actualStaffId) {
            feedback.showError(
                t(
                    'booking.selectMaster',
                    'Пожалуйста, выберите мастера перед продолжением.',
                ),
            );
            return;
        }

        if (!branchId) {
            feedback.showError(
                t(
                    'booking.selectBranch',
                    'Пожалуйста, выберите филиал перед продолжением.',
                ),
            );
            return;
        }

        // Resolve staff for this command without navigating the wizard mid-flight.
        // The guest auth-choice callback persists its own resolved selection.
        if (!isAuthed) {
            onAuthChoiceRequest(slotTime, actualStaffId);
            return;
        }

        inFlight.current = true;
        setLoading(true);
        try {
            const startISO = formatInTimeZone(
                slotTime,
                businessTz,
                "yyyy-MM-dd'T'HH:mm:ssXXX",
            );
            const requestBody =
                services.length === 1
                    ? {
                          biz_id: bizId,
                          branch_id: branchId,
                          service_id: services[0].id,
                          staff_id: actualStaffId,
                          start_at: startISO,
                      }
                    : {
                          biz_id: bizId,
                          branch_id: branchId,
                          staff_id: actualStaffId,
                          start_at: startISO,
                          services: services.map((service, index) => ({
                              service_id: service.id,
                              duration_min: service.duration_min,
                              order_index: index,
                          })),
                      };

            const { bookingId } = await withNetworkRetry(
                () => createQuickHoldBooking(requestBody),
                { retries: 1, delayMs: 500, scope: 'BookingFlow' },
            );

            trackFunnelEvent({
                event_type: 'booking_success',
                source: 'public',
                biz_id: bizId,
                branch_id: branchId,
                service_id: services[0].id,
                service_ids: services.map((service) => service.id),
                services_count: services.length,
                staff_id: actualStaffId,
                slot_start_at: startISO,
                booking_id: bookingId,
                session_id: getSessionId(),
            });

            logDebug('BookingFlow', 'Updating slots cache before redirect');
            if (onBookingCreated) {
                onBookingCreated();
                logDebug('BookingFlow', 'Slots cache update callback called');
            } else {
                logError(
                    'BookingFlow',
                    'onBookingCreated callback is not provided!',
                );
            }

            logDebug('BookingFlow', 'Redirecting to booking page', {
                bookingId,
            });
            setTimeout(() => {
                location.href = `/booking/${bookingId}`;
            }, 200);
        } catch (e) {
            if (e instanceof QuickHoldClientError && e.code === 'booking_slot_unavailable') {
                feedback.showError(fmtErr(e, t));
                onSlotUnavailable?.();
                return;
            }
            logError('BookingFlow', '[createBooking] unexpected error', e);
            const message =
                fmtErr(e, t) ||
                t(
                    'booking.error.technical',
                    'Произошла техническая ошибка при создании бронирования. Пожалуйста, проверьте подключение к интернету и попробуйте еще раз.',
                );
            feedback.showError(message);
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    }

    return { createBooking, loading };
}
