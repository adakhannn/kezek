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
    /** Одна или несколько услуг (комплекс); при одной — hold_slot_guest, при нескольких — hold_complex_slot_guest */
    services: Service[];
    staffId: string; // Может быть 'any'
    branchId: string;
    t: (key: string, fallback?: string) => string;
    onBookingCreated?: () => void; // Колбэк для обновления кэша слотов после создания бронирования
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
            servicesCount: services.length,
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
        
        if (!services.length || !actualStaffId || !branchId || !slotTime) {
            const missingFields = [];
            if (!services.length) missingFields.push(t('booking.selectService', 'услуга'));
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
            
            if (!bizId || !branchId || !actualStaffId) {
                const missing = [];
                if (!bizId) missing.push('biz_id');
                if (!branchId) missing.push('branch_id');
                if (!actualStaffId) missing.push('staff_id');
                logError('GuestBooking', 'Missing required fields', { missing, bizId, branchId, staffId: actualStaffId });
                alert(
                    t(
                        'booking.guest.missingData',
                        'Данные для бронирования неполные. Пожалуйста, выберите филиал, мастера, услугу и время.'
                    ) + `\nОтсутствуют: ${missing.join(', ')}`
                );
                return;
            }

            const requestBody: Record<string, unknown> = {
                biz_id: bizId,
                branch_id: branchId,
                staff_id: actualStaffId,
                start_at: startISO,
                client_name: name,
                client_phone: phone,
                client_email: email || null,
            };
            if (services.length === 1) {
                requestBody.service_id = services[0].id;
            } else {
                requestBody.services = services.map((s, index) => ({
                    service_id: s.id,
                    duration_min: s.duration_min,
                    order_index: index,
                }));
            }
            
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

            // ApiSuccessResponse оборачивает данные в поле `data`, поэтому booking_id может быть как в корне, так и внутри `data`
            const bookingId: string | undefined =
                (result && typeof result === 'object'
                    ? (result.booking_id as string | undefined) || (result.data?.booking_id as string | undefined)
                    : undefined);

            if (!response.ok || !result.ok) {
                // Если есть детали ошибок валидации, показываем их
                let apiMessage: string | undefined = result?.message || result?.error;
                
                // Проверяем, является ли ошибка связанной с занятым слотом
                const isSlotBookedError = 
                    apiMessage?.toLowerCase().includes('time slot is already booked') ||
                    apiMessage?.toLowerCase().includes('already booked') ||
                    apiMessage?.toLowerCase().includes('слот уже занят');
                
                if (isSlotBookedError) {
                    // Обновляем список слотов, если слот уже занят
                    if (onBookingCreated) {
                        onBookingCreated();
                    }
                    apiMessage = t(
                        'booking.guest.error.slotBooked',
                        'Этот слот уже занят. Список слотов обновлен, пожалуйста, выберите другое время.'
                    );
                } else if (result?.details?.errors && Array.isArray(result.details.errors)) {
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

            if (!bookingId) {
                // Успешный ответ без booking_id — это некорректное состояние, логируем и показываем пользователю сообщение
                logError('GuestBooking', 'Successful response without booking_id', { result });
                alert(
                    t(
                        'booking.guest.error.noBookingId',
                        'Бронирование было создано, но не удалось получить его номер. Свяжитесь с салоном для уточнения.'
                    )
                );
                return;
            }

            // Обновляем кэш слотов ПЕРЕД закрытием модального окна и редиректом
            // Это важно, чтобы слоты обновились до того, как пользователь увидит страницу
            logDebug('GuestBooking', 'Updating slots cache before redirect');
            if (onBookingCreated) {
                onBookingCreated();
                logDebug('GuestBooking', 'Slots cache update callback called');
            } else {
                logError('GuestBooking', 'onBookingCreated callback is not provided!');
            }

            // Закрываем модальное окно
            closeModal();

            // Редирект на страницу бронирования
            // Используем небольшую задержку, чтобы дать время обновиться кэшу слотов
            logDebug('GuestBooking', 'Redirecting to booking page', { bookingId });
            // Используем setTimeout для гарантии, что onBookingCreated успеет выполниться
            // и React успеет обработать обновление состояния
            setTimeout(() => {
                location.href = `/booking/${bookingId}`;
            }, 200);
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

