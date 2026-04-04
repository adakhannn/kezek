import { formatInTimeZone } from 'date-fns-tz';
import { useState } from 'react';

import type { Service } from '../types';
import { fmtErr, withNetworkRetry } from '../utils';

import { trackFunnelEvent, getSessionId } from '@/lib/funnelEvents';
import { logDebug, logError } from '@/lib/log';
import { createQuickHoldBooking } from '@/lib/quickHoldClient';
import { TZ } from '@/lib/time';

type BookingFeedbackApi = {
    showError: (message: string, duration?: number) => string;
};

type UseBookingCreationParams = {
    bizId: string;
    branchId: string;
    /** РћРґРЅР° РёР»Рё РЅРµСЃРєРѕР»СЊРєРѕ СѓСЃР»СѓРі (РєРѕРјРїР»РµРєСЃ); РїСЂРё РѕРґРЅРѕР№ РІС‹Р·С‹РІР°РµС‚СЃСЏ hold_slot, РїСЂРё РЅРµСЃРєРѕР»СЊРєРёС… - hold_complex_slot */
    services: Service[];
    staffId: string;
    isAuthed: boolean;
    t: (key: string, fallback?: string) => string;
    onAuthChoiceRequest: (slotTime: Date, slotStaffId?: string) => void;
    onStaffIdChange?: (staffId: string) => void;
    onBookingCreated?: () => void;
    feedback: BookingFeedbackApi;
};

export function useBookingCreation(params: UseBookingCreationParams) {
    const {
        bizId,
        branchId,
        services,
        staffId,
        isAuthed,
        t,
        onAuthChoiceRequest,
        onStaffIdChange,
        onBookingCreated,
        feedback,
    } = params;
    const [loading, setLoading] = useState(false);

    async function createBooking(slotTime: Date, slotStaffId?: string) {
        if (!services.length) {
            feedback.showError(
                t(
                    'booking.selectService',
                    'РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІС‹Р±РµСЂРёС‚Рµ СѓСЃР»СѓРіСѓ РїРµСЂРµРґ РїСЂРѕРґРѕР»Р¶РµРЅРёРµРј.',
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
                        'РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РјР°СЃС‚РµСЂР° РґР»СЏ РІС‹Р±СЂР°РЅРЅРѕРіРѕ РІСЂРµРјРµРЅРё. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІС‹Р±РµСЂРёС‚Рµ РІСЂРµРјСЏ РµС‰Рµ СЂР°Р·.',
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
                    'РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІС‹Р±РµСЂРёС‚Рµ РјР°СЃС‚РµСЂР° РїРµСЂРµРґ РїСЂРѕРґРѕР»Р¶РµРЅРёРµРј.',
                ),
            );
            return;
        }

        if (!branchId) {
            feedback.showError(
                t(
                    'booking.selectBranch',
                    'РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІС‹Р±РµСЂРёС‚Рµ С„РёР»РёР°Р» РїРµСЂРµРґ РїСЂРѕРґРѕР»Р¶РµРЅРёРµРј.',
                ),
            );
            return;
        }

        if (staffId === 'any' && slotStaffId && onStaffIdChange) {
            onStaffIdChange(slotStaffId);
        }

        if (!isAuthed) {
            onAuthChoiceRequest(slotTime, actualStaffId);
            return;
        }

        setLoading(true);
        try {
            const startISO = formatInTimeZone(
                slotTime,
                TZ,
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
            logError('BookingFlow', '[createBooking] unexpected error', e);
            const message =
                fmtErr(e, t) ||
                t(
                    'booking.error.technical',
                    'РџСЂРѕРёР·РѕС€Р»Р° С‚РµС…РЅРёС‡РµСЃРєР°СЏ РѕС€РёР±РєР° РїСЂРё СЃРѕР·РґР°РЅРёРё Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РїСЂРѕРІРµСЂСЊС‚Рµ РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє РёРЅС‚РµСЂРЅРµС‚Сѓ Рё РїРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰Рµ СЂР°Р·.',
                );
            feedback.showError(message);
        } finally {
            setLoading(false);
        }
    }

    return { createBooking, loading };
}
