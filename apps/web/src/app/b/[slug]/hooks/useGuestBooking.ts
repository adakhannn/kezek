import { formatInTimeZone } from 'date-fns-tz';
import { useState } from 'react';

import type { Service } from '../types';
import { fmtErr, isNetworkError, withNetworkRetry } from '../utils';

import { logDebug, logError } from '@/lib/log';
import { createGuestBookingRequest } from '@/lib/quickBookGuestClient';
import { TZ } from '@/lib/time';
import { validateEmail, validateName, validatePhone } from '@/lib/validation';

type BookingFeedbackApi = {
    showError: (message: string, duration?: number) => string;
};

type GuestBookingForm = {
    client_name: string;
    client_phone: string;
    client_email: string;
};

type UseGuestBookingParams = {
    bizId: string;
    services: Service[];
    staffId: string;
    branchId: string;
    t: (key: string, fallback?: string) => string;
    onBookingCreated?: () => void;
    feedback: BookingFeedbackApi;
};

export function useGuestBooking(params: UseGuestBookingParams) {
    const { bizId, services, staffId, branchId, t, onBookingCreated, feedback } = params;

    const [modalOpen, setModalOpen] = useState(false);
    const [slotTime, setSlotTime] = useState<Date | null>(null);
    const [slotStaffId, setSlotStaffId] = useState<string | null>(null);
    const [form, setForm] = useState<GuestBookingForm>({
        client_name: '',
        client_phone: '',
        client_email: '',
    });
    const [loading, setLoading] = useState(false);

    function openModal(nextSlotTime: Date, nextSlotStaffId?: string) {
        logDebug('GuestBooking', 'Opening modal', {
            slotTime: nextSlotTime,
            slotStaffId: nextSlotStaffId,
            currentStaffId: staffId,
        });
        setSlotTime(nextSlotTime);
        setSlotStaffId(nextSlotStaffId || null);
        setModalOpen(true);
    }

    function closeModal() {
        setModalOpen(false);
        setForm({ client_name: '', client_phone: '', client_email: '' });
        setSlotTime(null);
        setSlotStaffId(null);
    }

    async function createGuestBooking() {
        logDebug('GuestBooking', 'createGuestBooking called', {
            staffId,
            slotStaffId,
            branchId,
            servicesCount: services.length,
            slotTime,
        });

        let actualStaffId: string;
        if (staffId === 'any') {
            if (!slotStaffId) {
                logError('GuestBooking', 'slotStaffId is missing for "any" master', {
                    staffId,
                    slotStaffId,
                });
                feedback.showError(
                    t(
                        'booking.guest.missingStaffId',
                        'РќРµ СѓРґР°Р»РѕСЃСЊ РѕРїСЂРµРґРµР»РёС‚СЊ РјР°СЃС‚РµСЂР° РґР»СЏ РІС‹Р±СЂР°РЅРЅРѕРіРѕ РІСЂРµРјРµРЅРё. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІС‹Р±РµСЂРёС‚Рµ РІСЂРµРјСЏ РµС‰Рµ СЂР°Р·.',
                    ),
                );
                return;
            }
            actualStaffId = slotStaffId;
        } else {
            actualStaffId = staffId;
        }

        logDebug('GuestBooking', 'Determined actualStaffId', {
            actualStaffId,
            wasAny: staffId === 'any',
        });

        if (!services.length || !actualStaffId || !branchId || !slotTime) {
            const missingFields = [];
            if (!services.length) {
                missingFields.push(t('booking.selectService', 'СѓСЃР»СѓРіР°'));
            }
            if (!actualStaffId) {
                missingFields.push(t('booking.selectMaster', 'РјР°СЃС‚РµСЂ'));
            }
            if (!branchId) {
                missingFields.push(t('booking.selectBranch', 'С„РёР»РёР°Р»'));
            }
            if (!slotTime) {
                missingFields.push(t('booking.selectTime', 'РІСЂРµРјСЏ'));
            }

            feedback.showError(
                t(
                    'booking.guest.missingData',
                    'Р”Р°РЅРЅС‹Рµ РґР»СЏ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ РЅРµРїРѕР»РЅС‹Рµ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІС‹Р±РµСЂРёС‚Рµ С„РёР»РёР°Р», РјР°СЃС‚РµСЂР°, СѓСЃР»СѓРіСѓ Рё РІСЂРµРјСЏ.',
                ) +
                    (missingFields.length > 0
                        ? `\nРћС‚СЃСѓС‚СЃС‚РІСѓСЋС‚: ${missingFields.join(', ')}`
                        : ''),
            );
            return;
        }

        const name = form.client_name.trim();
        const phone = form.client_phone.trim();
        const email = form.client_email.trim();

        const nameValidation = validateName(name, true);
        if (!nameValidation.valid) {
            feedback.showError(
                nameValidation.error ||
                    t('booking.guest.nameRequired', 'Р’РІРµРґРёС‚Рµ РІР°С€Рµ РёРјСЏ.'),
            );
            return;
        }

        const phoneValidation = validatePhone(phone, true);
        if (!phoneValidation.valid) {
            feedback.showError(
                phoneValidation.error ||
                    t(
                        'booking.guest.phoneRequired',
                        'Р’РІРµРґРёС‚Рµ РєРѕСЂСЂРµРєС‚РЅС‹Р№ РЅРѕРјРµСЂ С‚РµР»РµС„РѕРЅР°.',
                    ),
            );
            return;
        }

        if (email) {
            const emailValidation = validateEmail(email);
            if (!emailValidation.valid) {
                feedback.showError(
                    emailValidation.error ||
                        t(
                            'booking.guest.emailInvalid',
                            'РќРµРІРµСЂРЅС‹Р№ С„РѕСЂРјР°С‚ email.',
                        ),
                );
                return;
            }
        }

        setLoading(true);
        try {
            const startISO = formatInTimeZone(
                slotTime,
                TZ,
                "yyyy-MM-dd'T'HH:mm:ssXXX",
            );

            logDebug('GuestBooking', 'Formatted start_at', {
                startISO,
                slotTime: slotTime.toISOString(),
                timezone: TZ,
            });

            if (!bizId || !branchId || !actualStaffId) {
                const missing = [];
                if (!bizId) {
                    missing.push('biz_id');
                }
                if (!branchId) {
                    missing.push('branch_id');
                }
                if (!actualStaffId) {
                    missing.push('staff_id');
                }
                logError('GuestBooking', 'Missing required fields', {
                    missing,
                    bizId,
                    branchId,
                    staffId: actualStaffId,
                });
                feedback.showError(
                    t(
                        'booking.guest.missingData',
                        'Р”Р°РЅРЅС‹Рµ РґР»СЏ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ РЅРµРїРѕР»РЅС‹Рµ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РІС‹Р±РµСЂРёС‚Рµ С„РёР»РёР°Р», РјР°СЃС‚РµСЂР°, СѓСЃР»СѓРіСѓ Рё РІСЂРµРјСЏ.',
                    ) + `\nРћС‚СЃСѓС‚СЃС‚РІСѓСЋС‚: ${missing.join(', ')}`,
                );
                return;
            }

            const requestBody =
                services.length === 1
                    ? {
                          biz_id: bizId,
                          branch_id: branchId,
                          staff_id: actualStaffId,
                          start_at: startISO,
                          client_name: name,
                          client_phone: phone,
                          client_email: email || null,
                          service_id: services[0].id,
                      }
                    : {
                          biz_id: bizId,
                          branch_id: branchId,
                          staff_id: actualStaffId,
                          start_at: startISO,
                          client_name: name,
                          client_phone: phone,
                          client_email: email || null,
                          services: services.map((service, index) => ({
                              service_id: service.id,
                              duration_min: service.duration_min,
                              order_index: index,
                          })),
                      };

            logDebug('GuestBooking', 'Sending request', requestBody);

            const { bookingId } = await withNetworkRetry(
                () => createGuestBookingRequest(requestBody),
                { retries: 1, delayMs: 700, scope: 'GuestBooking' },
            );

            logDebug('GuestBooking', 'Updating slots cache before redirect');
            if (onBookingCreated) {
                onBookingCreated();
                logDebug('GuestBooking', 'Slots cache update callback called');
            } else {
                logError(
                    'GuestBooking',
                    'onBookingCreated callback is not provided!',
                );
            }

            closeModal();

            logDebug('GuestBooking', 'Redirecting to booking page', { bookingId });
            setTimeout(() => {
                location.href = `/booking/${bookingId}`;
            }, 200);
        } catch (e) {
            logError('GuestBooking', '[createGuestBooking] unexpected error', e);
            let message =
                fmtErr(e, t) ||
                t(
                    'booking.guest.error.technical',
                    'РџСЂРѕРёР·РѕС€Р»Р° С‚РµС…РЅРёС‡РµСЃРєР°СЏ РѕС€РёР±РєР° РїСЂРё СЃРѕР·РґР°РЅРёРё Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РїСЂРѕРІРµСЂСЊС‚Рµ РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє РёРЅС‚РµСЂРЅРµС‚Сѓ Рё РїРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰Рµ СЂР°Р·.',
                );

            if (isNetworkError(e)) {
                message = t(
                    'booking.guest.error.network',
                    'РќРµ СѓРґР°Р»РѕСЃСЊ СЃРІСЏР·Р°С‚СЊСЃСЏ СЃ СЃРµСЂРІРµСЂРѕРј. РџСЂРѕРІРµСЂСЊС‚Рµ РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє РёРЅС‚РµСЂРЅРµС‚Сѓ Рё РїРѕРїСЂРѕР±СѓР№С‚Рµ РµС‰Рµ СЂР°Р·.',
                );
            }

            feedback.showError(message);
        } finally {
            setLoading(false);
        }
    }

    return {
        modalOpen,
        slotTime,
        form,
        loading,
        openModal,
        closeModal,
        setForm,
        createGuestBooking,
    };
}
