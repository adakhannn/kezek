/**
 * Быстрые действия для операторов
 * 
 * Кнопки для подтверждения/отмены/отметки прихода без лишней навигации
 */

'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ConfirmDialog } from '@/components/dashboard';
import { useState } from 'react';

interface QuickActionsProps {
    bookingId: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled' | 'no_show';
    startAt: string;
    onConfirm: (id: string) => void;
    onCancel: (id: string) => void;
    onMarkAttendance: (id: string, attended: boolean) => void;
    compact?: boolean;
}

export function QuickActions({
    bookingId,
    status,
    startAt,
    onConfirm,
    onCancel,
    onMarkAttendance,
    compact = false,
}: QuickActionsProps) {
    const { t } = useLanguage();
    const [confirmDialog, setConfirmDialog] = useState<'confirm' | 'cancel' | 'attended' | 'noShow' | null>(null);

    const isPast = new Date(startAt) < new Date();
    const canMarkAttendance = isPast && (status === 'confirmed' || status === 'hold');

    const handleConfirm = () => {
        setConfirmDialog('confirm');
    };

    const handleCancel = () => {
        setConfirmDialog('cancel');
    };

    const handleAttended = () => {
        setConfirmDialog('attended');
    };

    const handleNoShow = () => {
        setConfirmDialog('noShow');
    };

    const executeAction = () => {
        if (!confirmDialog) return;

        switch (confirmDialog) {
            case 'confirm':
                onConfirm(bookingId);
                break;
            case 'cancel':
                onCancel(bookingId);
                break;
            case 'attended':
                onMarkAttendance(bookingId, true);
                break;
            case 'noShow':
                onMarkAttendance(bookingId, false);
                break;
        }
        setConfirmDialog(null);
    };

    if (compact) {
        return (
            <>
                <div className="flex items-center gap-1">
                    {status === 'hold' && (
                        <button
                            onClick={handleConfirm}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title={t('bookings.actions.confirm', 'Подтвердить')}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </button>
                    )}
                    {status !== 'cancelled' && status !== 'paid' && (
                        <button
                            onClick={handleCancel}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title={t('bookings.actions.cancel', 'Отменить')}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    {canMarkAttendance && (
                        <>
                            <button
                                onClick={handleAttended}
                                className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                title={t('bookings.actions.attended', 'Пришел')}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </button>
                            <button
                                onClick={handleNoShow}
                                className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded transition-colors"
                                title={t('bookings.actions.noShow', 'Не пришел')}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
                <ConfirmDialog
                    isOpen={confirmDialog !== null}
                    title={
                        confirmDialog === 'confirm'
                            ? t('bookings.actions.confirmTitle', 'Подтвердить бронь')
                            : confirmDialog === 'cancel'
                            ? t('bookings.actions.cancelTitle', 'Отменить бронь')
                            : confirmDialog === 'attended'
                            ? t('bookings.actions.attendedTitle', 'Отметить приход')
                            : t('bookings.actions.noShowTitle', 'Отметить неявку')
                    }
                    message={
                        confirmDialog === 'confirm'
                            ? t('bookings.actions.confirmMessage', 'Вы уверены, что хотите подтвердить эту бронь?')
                            : confirmDialog === 'cancel'
                            ? t('bookings.actions.cancelMessage', 'Вы уверены, что хотите отменить эту бронь?')
                            : confirmDialog === 'attended'
                            ? t('bookings.actions.attendedMessage', 'Отметить клиента как пришедшего?')
                            : t('bookings.actions.noShowMessage', 'Отметить клиента как не пришедшего?')
                    }
                    confirmLabel={t('bookings.actions.confirm', 'Подтвердить')}
                    cancelLabel={t('bookings.actions.cancel', 'Отмена')}
                    variant={confirmDialog === 'cancel' || confirmDialog === 'noShow' ? 'danger' : 'info'}
                    onConfirm={executeAction}
                    onCancel={() => setConfirmDialog(null)}
                />
            </>
        );
    }

    return (
        <>
            <div className="flex flex-wrap gap-2">
                {status === 'hold' && (
                    <button
                        onClick={handleConfirm}
                        className="px-3 py-2 text-xs sm:text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm hover:shadow"
                    >
                        {t('bookings.actions.confirm', 'Подтвердить')}
                    </button>
                )}
                {status !== 'cancelled' && status !== 'paid' && (
                    <button
                        onClick={handleCancel}
                        className="px-3 py-2 text-xs sm:text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 transition-colors shadow-sm hover:shadow"
                    >
                        {t('bookings.actions.cancel', 'Отменить')}
                    </button>
                )}
                {canMarkAttendance && (
                    <>
                        <button
                            onClick={handleAttended}
                            className="px-3 py-2 text-xs sm:text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors shadow-sm hover:shadow"
                        >
                            {t('bookings.actions.attended', 'Пришел')}
                        </button>
                        <button
                            onClick={handleNoShow}
                            className="px-3 py-2 text-xs sm:text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 active:bg-orange-800 transition-colors shadow-sm hover:shadow"
                        >
                            {t('bookings.actions.noShow', 'Не пришел')}
                        </button>
                    </>
                )}
            </div>
            <ConfirmDialog
                isOpen={confirmDialog !== null}
                title={
                    confirmDialog === 'confirm'
                        ? t('bookings.actions.confirmTitle', 'Подтвердить бронь')
                        : confirmDialog === 'cancel'
                        ? t('bookings.actions.cancelTitle', 'Отменить бронь')
                        : confirmDialog === 'attended'
                        ? t('bookings.actions.attendedTitle', 'Отметить приход')
                        : t('bookings.actions.noShowTitle', 'Отметить неявку')
                }
                message={
                    confirmDialog === 'confirm'
                        ? t('bookings.actions.confirmMessage', 'Вы уверены, что хотите подтвердить эту бронь?')
                        : confirmDialog === 'cancel'
                        ? t('bookings.actions.cancelMessage', 'Вы уверены, что хотите отменить эту бронь?')
                        : confirmDialog === 'attended'
                        ? t('bookings.actions.attendedMessage', 'Отметить клиента как пришедшего?')
                        : t('bookings.actions.noShowMessage', 'Отметить клиента как не пришедшего?')
                }
                confirmLabel={t('bookings.actions.confirm', 'Подтвердить')}
                cancelLabel={t('bookings.actions.cancel', 'Отмена')}
                variant={confirmDialog === 'cancel' || confirmDialog === 'noShow' ? 'danger' : 'info'}
                onConfirm={executeAction}
                onCancel={() => setConfirmDialog(null)}
            />
        </>
    );
}

