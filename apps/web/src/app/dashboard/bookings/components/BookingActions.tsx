/**
 * Компонент для действий с бронированием
 * Вынесен из view.tsx для улучшения поддерживаемости
 */

'use client';

import { canMarkAttendance as canMarkAttendanceRule, canCancel, canConfirm } from '@core-domain/booking';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type BookingActionsProps = {
    bookingId: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show';
    startAt: string;
    onConfirm: (id: string) => void;
    onCancel: (id: string) => void;
    onMarkAttendance: (id: string, attended: boolean) => void;
};

export function BookingActions({
    bookingId,
    status,
    startAt,
    onConfirm,
    onCancel,
    onMarkAttendance,
}: BookingActionsProps) {
    const { t } = useLanguage();

    const showMarkAttendance = canMarkAttendanceRule(status, { bookingStartAt: startAt });
    const showConfirm = canConfirm(status);
    const showCancel = canCancel(status);

    return (
        <div className="flex flex-wrap gap-2">
            {showConfirm && (
                <button
                    onClick={() => onConfirm(bookingId)}
                    className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm hover:shadow"
                >
                    {t('bookings.actions.confirm', 'Подтвердить')}
                </button>
            )}
            {showCancel && (
                <button
                    onClick={() => onCancel(bookingId)}
                    className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors shadow-sm hover:shadow"
                >
                    {t('bookings.actions.cancel', 'Отменить')}
                </button>
            )}
            {showMarkAttendance && (
                <>
                    <button
                        onClick={() => onMarkAttendance(bookingId, true)}
                        className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors shadow-sm hover:shadow"
                    >
                        {t('bookings.actions.attended', 'Пришел')}
                    </button>
                    <button
                        onClick={() => onMarkAttendance(bookingId, false)}
                        className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 active:bg-orange-800 transition-colors shadow-sm hover:shadow"
                    >
                        {t('bookings.actions.noShow', 'Не пришел')}
                    </button>
                </>
            )}
        </div>
    );
}

