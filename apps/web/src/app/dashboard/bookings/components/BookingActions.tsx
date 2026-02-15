/**
 * Компонент для действий с бронированием
 * Вынесен из view.tsx для улучшения поддерживаемости
 */

'use client';

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

    const isPast = new Date(startAt) < new Date();
    const canMarkAttendance = isPast && (status === 'confirmed' || status === 'hold');

    return (
        <div className="flex flex-wrap gap-2">
            {status === 'hold' && (
                <button
                    onClick={() => onConfirm(bookingId)}
                    className="px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    {t('bookings.list.confirm', 'Подтвердить')}
                </button>
            )}
            {status !== 'cancelled' && status !== 'paid' && (
                <button
                    onClick={() => onCancel(bookingId)}
                    className="px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                    {t('bookings.list.cancel', 'Отменить')}
                </button>
            )}
            {canMarkAttendance && (
                <>
                    <button
                        onClick={() => onMarkAttendance(bookingId, true)}
                        className="px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        {t('bookings.list.attended', 'Пришел')}
                    </button>
                    <button
                        onClick={() => onMarkAttendance(bookingId, false)}
                        className="px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                    >
                        {t('bookings.list.noShow', 'Не пришел')}
                    </button>
                </>
            )}
        </div>
    );
}

