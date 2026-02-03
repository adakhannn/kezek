import { useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '@/lib/supabaseClient';
import { logError } from '@/lib/log';
import { TZ } from '@/lib/time';
import { fmtErr, withNetworkRetry } from '../utils';
import type { Service } from '../types';

type UseBookingCreationParams = {
    bizId: string;
    branchId: string;
    service: Service | null;
    staffId: string;
    isAuthed: boolean;
    t: (key: string, fallback?: string) => string;
    onGuestBookingRequest: (slotTime: Date) => void;
};

export function useBookingCreation(params: UseBookingCreationParams) {
    const { bizId, branchId, service, staffId, isAuthed, t, onGuestBookingRequest } = params;
    const [loading, setLoading] = useState(false);

    async function createBooking(slotTime: Date) {
        if (!service) {
            alert(t('booking.selectService', 'Пожалуйста, выберите услугу перед продолжением.'));
            return;
        }
        if (!staffId) {
            alert(t('booking.selectMaster', 'Пожалуйста, выберите мастера перед продолжением.'));
            return;
        }
        if (!branchId) {
            alert(t('booking.selectBranch', 'Пожалуйста, выберите филиал перед продолжением.'));
            return;
        }

        // Если не авторизован, показываем модальное окно для гостевой брони
        if (!isAuthed) {
            onGuestBookingRequest(slotTime);
            return;
        }

        setLoading(true);
        try {
            const startISO = formatInTimeZone(slotTime, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
            
            // Создаем бронирование со статусом hold, затем сразу подтверждаем
            const { data: holdData, error: holdError } = await supabase.rpc('hold_slot', {
                p_biz_id: bizId,
                p_branch_id: branchId,
                p_service_id: service.id,
                p_staff_id: staffId,
                p_start: startISO,
            });

            if (holdError) {
                logError('BookingFlow', '[hold_slot] error', holdError);
                alert(
                    fmtErr(holdError, t) ||
                        t(
                            'booking.error.holdFailed',
                            'Не удалось зарезервировать слот. Пожалуйста, обновите страницу и попробуйте ещё раз.'
                        )
                );
                return;
            }

            const bookingId = String(holdData);
            
            // Сразу подтверждаем бронирование
            const { error: confirmError } = await supabase.rpc('confirm_booking', { p_booking_id: bookingId });
            if (confirmError) {
                logError('BookingFlow', '[confirm_booking] error', confirmError);
                alert(
                    fmtErr(confirmError, t) ||
                        t(
                            'booking.error.confirmFailed',
                            'Слот был зарезервирован, но не удалось подтвердить бронирование. Свяжитесь с салоном для уточнения.'
                        )
                );
                return;
            }

            // Отправляем уведомление о подтверждении (best effort, с повторной попыткой при сетевой ошибке)
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
                logError('BookingNotify', 'Failed to send confirm notification', e);
            });

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

