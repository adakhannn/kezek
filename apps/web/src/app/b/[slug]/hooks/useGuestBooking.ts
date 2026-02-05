import { formatInTimeZone } from 'date-fns-tz';
import { useState } from 'react';

import type { Service } from '../types';
import { fmtErr, isNetworkError, withNetworkRetry } from '../utils';

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
    service: Service | null;
    staffId: string; // Может быть 'any'
    branchId: string;
    t: (key: string, fallback?: string) => string;
    onBookingCreated?: () => void; // Колбэк для обновления кэша слотов после создания бронирования
};

export function useGuestBooking(params: UseGuestBookingParams) {
    const { bizId, service, staffId, branchId, t, onBookingCreated } = params;
    
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
        logDebug('GuestBooking', 'Opening modal', { slotTime, slotStaffId, currentStaffId: staffId });
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
        logDebug('GuestBooking', 'createGuestBooking called', { 
            staffId, 
            slotStaffId, 
            branchId, 
            serviceId: service?.id,
            slotTime 
        });
        
        // Определяем реального мастера: если выбран "любой мастер", используем мастера из слота
        let actualStaffId: string;
        if (staffId === 'any') {
            if (!slotStaffId) {
                logError('GuestBooking', 'slotStaffId is missing for "any" master', { staffId, slotStaffId });
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
        
        logDebug('GuestBooking', 'Determined actualStaffId', { actualStaffId, wasAny: staffId === 'any' });
        
        if (!service || !actualStaffId || !branchId || !slotTime) {
            const missingFields = [];
            if (!service) missingFields.push(t('booking.selectService', 'услуга'));
            if (!actualStaffId) missingFields.push(t('booking.selectMaster', 'мастер'));
            if (!branchId) missingFields.push(t('booking.selectBranch', 'филиал'));
            if (!slotTime) missingFields.push(t('booking.selectTime', 'время'));
            
            alert(
                t(
                    'booking.guest.missingData',
                    'Данные для бронирования неполные. Пожалуйста, выберите филиал, мастера, услугу и время.'
                ) + (missingFields.length > 0 ? `\nОтсутствуют: ${missingFields.join(', ')}` : '')
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
            // Форматируем дату в ISO 8601 формат с таймзоной
            // Используем формат с двоеточием в оффсете (XXX), который соответствует ISO 8601
            const startISO = formatInTimeZone(slotTime, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
            
            // Логируем для отладки
            logDebug('GuestBooking', 'Formatted start_at', { 
                startISO, 
                slotTime: slotTime.toISOString(),
                timezone: TZ 
            });
            
            // Проверяем, что все обязательные поля заполнены и валидны
            if (!bizId || !branchId || !service.id || !actualStaffId) {
                const missing = [];
                if (!bizId) missing.push('biz_id');
                if (!branchId) missing.push('branch_id');
                if (!service.id) missing.push('service_id');
                if (!actualStaffId) missing.push('staff_id');
                
                logError('GuestBooking', 'Missing required fields', { missing, bizId, branchId, serviceId: service.id, staffId: actualStaffId });
                alert(
                    t(
                        'booking.guest.missingData',
                        'Данные для бронирования неполные. Пожалуйста, выберите филиал, мастера, услугу и время.'
                    ) + `\nОтсутствуют: ${missing.join(', ')}`
                );
                return;
            }
            
            const requestBody = {
                biz_id: bizId,
                branch_id: branchId,
                service_id: service.id,
                staff_id: actualStaffId,
                start_at: startISO,
                client_name: name,
                client_phone: phone,
                client_email: email || null,
            };
            
            // Логируем отправляемые данные для отладки
            logDebug('GuestBooking', 'Sending request', requestBody);
            
            const response = await withNetworkRetry(
                () =>
                    fetch('/api/quick-book-guest', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify(requestBody),
                    }),
                { retries: 1, delayMs: 700, scope: 'GuestBooking' }
            );

            const result = await response.json();
            
            // Логируем ответ для отладки
            logDebug('GuestBooking', 'Received response', { status: response.status, result });

            if (!response.ok || !result.ok) {
                // Если есть детали ошибок валидации, показываем их
                let apiMessage: string | undefined = result?.message || result?.error;
                
                if (result?.details?.errors && Array.isArray(result.details.errors)) {
                    const validationErrors = result.details.errors
                        .map((err: { path?: string; message?: string }) => {
                            const field = err.path || 'unknown';
                            const msg = err.message || 'Invalid value';
                            return `${field}: ${msg}`;
                        })
                        .join('\n');
                    
                    if (validationErrors) {
                        apiMessage = t(
                            'booking.guest.error.validation',
                            `Ошибка валидации данных: ${validationErrors}`
                        );
                    }
                }
                
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

            // Обновляем кэш слотов после успешного создания бронирования
            if (onBookingCreated) {
                onBookingCreated();
            }

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

