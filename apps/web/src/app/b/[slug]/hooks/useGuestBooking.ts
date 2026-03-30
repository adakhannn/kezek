import { formatInTimeZone } from 'date-fns-tz';
import { useState } from 'react';

import type { Service } from '../types';
import { fmtErr, isNetworkError, withNetworkRetry } from '../utils';

import { createGuestBookingRequest } from '@/lib/quickBookGuestClient';
import { logDebug, logError } from '@/lib/log';
import { TZ } from '@/lib/time';
import { validateEmail, validateName, validatePhone } from '@/lib/validation';

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
};

export function useGuestBooking(params: UseGuestBookingParams) {
    const { bizId, services, staffId, branchId, t, onBookingCreated } = params;

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
                alert(
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
            const missingFields = [];
            if (!services.length) {
                missingFields.push(t('booking.selectService', 'услуга'));
            }
            if (!actualStaffId) {
                missingFields.push(t('booking.selectMaster', 'мастер'));
            }
            if (!branchId) {
                missingFields.push(t('booking.selectBranch', 'филиал'));
            }
            if (!slotTime) {
                missingFields.push(t('booking.selectTime', 'время'));
            }

            alert(
                t(
                    'booking.guest.missingData',
                    'Данные для бронирования неполные. Пожалуйста, выберите филиал, мастера, услугу и время.',
                ) +
                    (missingFields.length > 0
                        ? `\nОтсутствуют: ${missingFields.join(', ')}`
                        : ''),
            );
            return;
        }

        const name = form.client_name.trim();
        const phone = form.client_phone.trim();
        const email = form.client_email.trim();

        const nameValidation = validateName(name, true);
        if (!nameValidation.valid) {
            alert(
                nameValidation.error ||
                    t('booking.guest.nameRequired', 'Введите ваше имя.'),
            );
            return;
        }

        const phoneValidation = validatePhone(phone, true);
        if (!phoneValidation.valid) {
            alert(
                phoneValidation.error ||
                    t(
                        'booking.guest.phoneRequired',
                        'Введите корректный номер телефона.',
                    ),
            );
            return;
        }

        if (email) {
            const emailValidation = validateEmail(email);
            if (!emailValidation.valid) {
                alert(
                    emailValidation.error ||
                        t(
                            'booking.guest.emailInvalid',
                            'Неверный формат email.',
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
                alert(
                    t(
                        'booking.guest.missingData',
                        'Данные для бронирования неполные. Пожалуйста, выберите филиал, мастера, услугу и время.',
                    ) + `\nОтсутствуют: ${missing.join(', ')}`,
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
                    'Произошла техническая ошибка при создании бронирования. Пожалуйста, проверьте подключение к интернету и попробуйте еще раз.',
                );

            if (isNetworkError(e)) {
                message = t(
                    'booking.guest.error.network',
                    'Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте еще раз.',
                );
            }

            alert(message);
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
