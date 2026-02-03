import { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { logError } from '@/lib/log';
import { TZ } from '@/lib/time';
import { fmtErr, isNetworkError, withNetworkRetry } from '../utils';
import { validateEmail, validateName, validatePhone } from '@/lib/validation';
import type { Service } from '../types';

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
    const [form, setForm] = useState<GuestBookingForm>({
        client_name: '',
        client_phone: '',
        client_email: '',
    });
    const [loading, setLoading] = useState(false);

    function openModal(slotTime: Date) {
        setSlotTime(slotTime);
        setModalOpen(true);
    }

    function closeModal() {
        setModalOpen(false);
        setForm({ client_name: '', client_phone: '', client_email: '' });
        setSlotTime(null);
    }

    async function createGuestBooking() {
        if (!service || !staffId || !branchId || !slotTime) {
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
                            service_id: service.id,
                            staff_id: staffId,
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

