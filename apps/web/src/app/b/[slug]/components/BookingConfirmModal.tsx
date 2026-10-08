'use client';

import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';

type BookingConfirmModalProps = {
    open: boolean;
    busy: boolean;
    onClose: () => void;
    onConfirm: () => void;
    dayLabel: string;
    timeLabel: string;
    branchName: string;
    staffName: string;
    serviceNames: string[];
    t: (key: string, fallback?: string) => string;
};

export function BookingConfirmModal({
    open,
    busy,
    onClose,
    onConfirm,
    dayLabel,
    timeLabel,
    branchName,
    staffName,
    serviceNames,
    t,
}: BookingConfirmModalProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            dismissible={!busy}
            title={t('booking.confirm.title', 'Подтвердить запись')}
            description={t('booking.confirm.description', 'Проверьте детали. Запись будет создана только после подтверждения.')}
            footer={
                <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                        {t('booking.confirm.cancel', 'Вернуться')}
                    </Button>
                    <Button type="button" onClick={onConfirm} disabled={busy}>
                        {busy ? t('booking.confirm.saving', 'Создаём запись…') : t('booking.confirm.submit', 'Подтвердить запись')}
                    </Button>
                </div>
            }
        >
            <dl className="grid gap-3 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] p-4 sm:grid-cols-[8rem_1fr]">
                <dt className="text-[var(--text-secondary)]">{t('booking.confirm.when', 'Когда')}</dt>
                <dd className="font-medium text-[var(--text-primary)]">{dayLabel}, {timeLabel}</dd>
                <dt className="text-[var(--text-secondary)]">{t('booking.confirm.branch', 'Филиал')}</dt>
                <dd className="font-medium text-[var(--text-primary)]">{branchName}</dd>
                <dt className="text-[var(--text-secondary)]">{t('booking.confirm.staff', 'Сотрудник')}</dt>
                <dd className="font-medium text-[var(--text-primary)]">{staffName}</dd>
                <dt className="text-[var(--text-secondary)]">{t('booking.confirm.services', 'Услуги')}</dt>
                <dd className="font-medium text-[var(--text-primary)]">{serviceNames.join(', ')}</dd>
            </dl>
        </Dialog>
    );
}
