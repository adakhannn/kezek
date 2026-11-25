import { formatInTimeZone } from 'date-fns-tz';
import { useRef, useState } from 'react';

import type { Service } from '../types';
import { fmtErr, isNetworkError, withNetworkRetry } from '../utils';

import { getSessionId, trackFunnelEvent } from '@/lib/funnelEvents';
import { logDebug, logError } from '@/lib/log';
import { createGuestBookingRequest } from '@/lib/quickBookGuestClient';
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
    /** The business time zone (businesses.tz) of the slot times. */
    businessTz: string;
    services: Service[];
    staffId: string;
    branchId: string;
    t: (key: string, fallback?: string) => string;
    onBookingCreated?: () => void;
    feedback: BookingFeedbackApi;
};

export function useGuestBooking(params: UseGuestBookingParams) {
    const { bizId, businessTz, services, staffId, branchId, t, onBookingCreated, feedback } = params;

    const [modalOpen, setModalOpen] = useState(false);
    const [slotTime, setSlotTime] = useState<Date | null>(null);
    const [slotStaffId, setSlotStaffId] = useState<string | null>(null);
    const [form, setForm] = useState<GuestBookingForm>({
        client_name: '',
        client_phone: '',
        client_email: '',
    });
    const [loading, setLoading] = useState(false);
    const inFlight = useRef(false);

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
        if (inFlight.current) return;
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
                        'Не удалось определить мастера для выбранного времени. Пожалуйста, выберите время еще раз.',
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
            // Nouns for the list; the booking.select* keys are imperative button labels.
            const missingFields: string[] = [];
            if (!services.length) {
                missingFields.push(t('booking.guest.missingField.service', 'услуга'));
            }
            if (!actualStaffId) {
                missingFields.push(t('booking.guest.missingField.master', 'мастер'));
            }
            if (!branchId) {
                missingFields.push(t('booking.guest.missingField.branch', 'филиал'));
            }
            if (!slotTime) {
                missingFields.push(t('booking.guest.missingField.time', 'время'));
            }

            const missingLabel = t('booking.guest.missingFields', 'Не выбрано');
            feedback.showError(
                t(
                    'booking.guest.missingData',
                    'Данные для бронирования неполные. Пожалуйста, выберите филиал, мастера, услугу и время.',
                ) +
                    (missingFields.length > 0
                        ? `\n${missingLabel}: ${missingFields.join(', ')}`
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
                name
                    ? t('booking.guest.nameInvalid', 'Введите имя длиной от 2 до 100 символов.')
                    : t('booking.guest.nameRequired', 'Введите ваше имя.'),
            );
            return;
        }

        const phoneValidation = validatePhone(phone, true);
        if (!phoneValidation.valid) {
            feedback.showError(
                phone
                    ? t('booking.guest.phoneInvalid', 'Введите телефон в международном формате, например +996555123456.')
                    : t('booking.guest.phoneRequired', 'Введите номер телефона.'),
            );
            return;
        }

        if (email) {
            const emailValidation = validateEmail(email);
            if (!emailValidation.valid) {
                feedback.showError(
                    t('booking.guest.emailInvalid', 'Введите корректный email длиной не более 255 символов.'),
                );
                return;
            }
        }

        inFlight.current = true;
        setLoading(true);
        try {
            const startISO = formatInTimeZone(
                slotTime,
                businessTz,
                "yyyy-MM-dd'T'HH:mm:ssXXX",
            );

            logDebug('GuestBooking', 'Formatted start_at', {
                startISO,
                slotTime: slotTime.toISOString(),
                timezone: businessTz,
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
                        'Данные для бронирования неполные. Пожалуйста, выберите филиал, мастера, услугу и время.',
                    ) + '\n' + t('booking.guest.missingIds', 'Отсутствуют: {fields}').replace('{fields}', missing.join(', ')),
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

            logDebug('GuestBooking', 'Sending booking request');

            const { bookingId } = await withNetworkRetry(
                () => createGuestBookingRequest(requestBody),
                { retries: 1, delayMs: 700, scope: 'GuestBooking' },
            );

            void trackFunnelEvent({
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
                    'Произошла техническая ошибка при создании бронирования. Пожалуйста, проверьте подключение к интернету и попробуйте еще раз.',
                );

            if (isNetworkError(e)) {
                message = t(
                    'booking.guest.error.network',
                    'Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте еще раз.',
                );
            }

            feedback.showError(message);
        } finally {
            inFlight.current = false;
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
