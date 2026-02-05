import { formatInTimeZone } from 'date-fns-tz';
import { useState } from 'react';

import type { Service } from '../types';
import { fmtErr, isNetworkError, withNetworkRetry } from '../utils';

import { logError } from '@/lib/log';
import { TZ } from '@/lib/time';
import { validateEmail, validateName, validatePhone } from '@/lib/validation';


type GuestBookingForm = {
    client_name: string;
    client_phone: string;
    client_email: string;
};

type UseGuestBookingParams = {
    bizId: string;
    service: Service | null;
    staffId: string;
    branchId: string;
    t: (key: string, fallback?: string) => string;
};

export function useGuestBooking(params: UseGuestBookingParams) {
    const { bizId, service, staffId, branchId, t } = params;
    
    const [modalOpen, setModalOpen] = useState(false);
    const [slotTime, setSlotTime] = useState<Date | null>(null);
    const [slotStaffId, setSlotStaffId] = useState<string | null>(null);
    const [form, setForm] = useState<GuestBookingForm>({
        client_name: '',
        client_phone: '',
        client_email: '',
    });
    const [loading, setLoading] = useState(false);

    function openModal(slotTime: Date, slotStaffId?: string) {
        setSlotTime(slotTime);
        setSlotStaffId(slotStaffId || null);
        setModalOpen(true);
    }

    function closeModal() {
        setModalOpen(false);
        setForm({ client_name: '', client_phone: '', client_email: '' });
        setSlotTime(null);
        setSlotStaffId(null);
    }

    async function createGuestBooking() {
        // Определяем реального мастера: если выбран "любой мастер", используем мастера из слота
        let actualStaffId: string;
        if (staffId === 'any') {
            if (!slotStaffId) {
                alert(
                    t(
                        'booking.guest.missingStaffId',
                        'Не удалось определить мастера для выбранного времени. Пожалуйста, выберите время еще раз.'
                    )
                );
                return;
            }
            actualStaffId = slotStaffId;
        } else {
            actualStaffId = staffId;
        }
        
        if (!service || !actualStaffId || !branchId || !slotTime) {
            alert(
                t(
                    'booking.guest.missingData',
                    'Данные для бронирования неполные. Пожалуйста, выберите филиал, мастера, услугу и время.'
                )
            );
            return;
        }

        // Валидация формы
        const name = form.client_name.trim();
        const phone = form.client_phone.trim();
        const email = form.client_email.trim();

        // Валидация имени
        const nameValidation = validateName(name, true);
        if (!nameValidation.valid) {
            alert(nameValidation.error || t('booking.guest.nameRequired', 'Введите ваше имя.'));
            return;
        }

        // Валидация телефона
        const phoneValidation = validatePhone(phone, true);
        if (!phoneValidation.valid) {
            alert(phoneValidation.error || t('booking.guest.phoneRequired', 'Введите корректный номер телефона.'));
            return;
        }

        // Валидация email (если заполнен)
        if (email) {
            const emailValidation = validateEmail(email);
            if (!emailValidation.valid) {
                alert(emailValidation.error || t('booking.guest.emailInvalid', 'Неверный формат email.'));
                return;
            }
        }

        setLoading(true);
        try {
            const startISO = formatInTimeZone(slotTime, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
            
            const response = await withNetworkRetry(
                () =>
                    fetch('/api/quick-book-guest', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            biz_id: bizId,
                            branch_id: branchId, // Добавляем branch_id в запрос
                            service_id: service.id,
                            staff_id: actualStaffId,
                            start_at: startISO,
                            client_name: name,
                            client_phone: phone,
                            client_email: email || null,
                        }),
                    }),
                { retries: 1, delayMs: 700, scope: 'GuestBooking' }
            );

            const result = await response.json();

            if (!response.ok || !result.ok) {
                const apiMessage: string | undefined = result?.message || result?.error;
                const message =
                    apiMessage ||
                    t(
                        'booking.guest.error.create',
                        'Не удалось создать бронирование. Пожалуйста, проверьте введённые данные и попробуйте ещё раз.'
                    );
                throw new Error(message);
            }

            // Закрываем модальное окно
            closeModal();

            // Редирект на страницу бронирования
            if (result.booking_id) {
                location.href = `/booking/${result.booking_id}`;
            }
        } catch (e) {
            logError('GuestBooking', '[createGuestBooking] unexpected error', e);
            let message =
                fmtErr(e, t) ||
                t(
                    'booking.guest.error.technical',
                    'Произошла техническая ошибка при создании бронирования. Пожалуйста, проверьте подключение к интернету и попробуйте ещё раз.'
                );

            if (isNetworkError(e)) {
                message = t(
                    'booking.guest.error.network',
                    'Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте ещё раз.'
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

