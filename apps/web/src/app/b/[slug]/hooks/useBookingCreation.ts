import { formatInTimeZone } from 'date-fns-tz';
import { useState } from 'react';

import type { Service } from '../types';
import { fmtErr, withNetworkRetry } from '../utils';

import { logError } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';


type UseBookingCreationParams = {
    bizId: string;
    branchId: string;
    service: Service | null;
    staffId: string;
    isAuthed: boolean;
    t: (key: string, fallback?: string) => string;
    onAuthChoiceRequest: (slotTime: Date, slotStaffId?: string) => void;
    onStaffIdChange?: (staffId: string) => void; // Колбэк для обновления staffId при выборе "любого мастера"
    onBookingCreated?: () => void; // Колбэк для обновления кэша слотов после создания бронирования
};

export function useBookingCreation(params: UseBookingCreationParams) {
    const { bizId, branchId, service, staffId, isAuthed, t, onAuthChoiceRequest, onStaffIdChange, onBookingCreated } = params;
    const [loading, setLoading] = useState(false);

    async function createBooking(slotTime: Date, slotStaffId?: string) {
        if (!service) {
            alert(t('booking.selectService', 'Пожалуйста, выберите услугу перед продолжением.'));
            return;
        }
        
        // Определяем реального мастера: если выбран "любой мастер", используем мастера из слота
        let actualStaffId: string;
        if (staffId === 'any') {
            if (!slotStaffId) {
                alert(t('booking.selectMaster', 'Не удалось определить мастера для выбранного времени. Пожалуйста, выберите время еще раз.'));
                return;
            }
            actualStaffId = slotStaffId;
        } else {
            actualStaffId = staffId;
        }
        
        if (!actualStaffId) {
            alert(t('booking.selectMaster', 'Пожалуйста, выберите мастера перед продолжением.'));
            return;
        }
        if (!branchId) {
            alert(t('booking.selectBranch', 'Пожалуйста, выберите филиал перед продолжением.'));
            return;
        }

        // Если выбран "любой мастер" и мы получили мастера из слота, обновляем staffId
        if (staffId === 'any' && slotStaffId && onStaffIdChange) {
            onStaffIdChange(slotStaffId);
        }

        // Если не авторизован, показываем модальное окно выбора (авторизация или запись без регистрации)
        if (!isAuthed) {
            onAuthChoiceRequest(slotTime, actualStaffId);
            return;
        }

        setLoading(true);
        try {
            const startISO = formatInTimeZone(slotTime, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
            
            // Создаем бронирование сразу со статусом confirmed (без hold)
            const { data: bookingData, error: bookingError } = await supabase.rpc('hold_slot', {
                p_biz_id: bizId,
                p_branch_id: branchId,
                p_service_id: service.id,
                p_staff_id: actualStaffId,
                p_start: startISO,
            });

            if (bookingError) {
                logError('BookingFlow', '[hold_slot] error', bookingError);
                alert(
                    fmtErr(bookingError, t) ||
                        t(
                            'booking.error.holdFailed',
                            'Не удалось создать бронирование. Пожалуйста, обновите страницу и попробуйте ещё раз.'
                        )
                );
                return;
            }

            const bookingId = String(bookingData);

            // Отправляем уведомление о создании бронирования (best effort, с повторной попыткой при сетевой ошибке)
            void withNetworkRetry(
                () =>
                    fetch('/api/notify', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ type: 'confirm', booking_id: bookingId }),
                    }),
                { retries: 1, delayMs: 500, scope: 'BookingNotify' }
            ).catch((e) => {
                // Не блокируем пользователя, просто логируем
                logError('BookingNotify', 'Failed to send booking notification', e);
            });

            // Обновляем кэш слотов после успешного создания бронирования
            if (onBookingCreated) {
                onBookingCreated();
            }

            // Редирект на страницу бронирования
            location.href = `/booking/${bookingId}`;
        } catch (e) {
            logError('BookingFlow', '[createBooking] unexpected error', e);
            const message =
                fmtErr(e, t) ||
                t(
                    'booking.error.technical',
                    'Произошла техническая ошибка при создании бронирования. Пожалуйста, проверьте подключение к интернету и попробуйте ещё раз.'
                );
            alert(message);
        } finally {
            setLoading(false);
        }
    }

    return { createBooking, loading };
}

