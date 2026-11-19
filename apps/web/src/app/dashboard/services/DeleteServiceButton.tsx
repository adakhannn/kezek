'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

export default function DeleteServiceButton({ id }: { id: string }) {
    const { t } = useLanguage();
    const r = useRouter();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    async function onDelete() {
        try {
            setLoading(true);
            const res = await fetch(`/api/services/${encodeURIComponent(id)}/delete`, { method: 'POST' });
            const payload = await res.json().catch(() => ({ ok: false, error: 'NON_JSON_RESPONSE' }));
            if (!res.ok || !payload.ok) {
                let errorMessage = payload.message || payload.error || `HTTP_${res.status}`;

                if (payload.details && payload.error === 'HAS_BOOKINGS') {
                    const { total, active, cancelled, bookings } = payload.details;
                    const label = {
                        total: t('services.delete.totalBookings', 'Всего броней'),
                        active: t('services.delete.activeBookings', 'Активных'),
                        cancelled: t('services.delete.cancelledBookings', 'Отменённых'),
                        examples: t('services.delete.examples', 'Примеры броней'),
                        booking: t('services.delete.bookingPrefix', 'Бронь'),
                        hint: t('services.delete.hint', 'Сначала отмените или удалите все брони, связанные с этой услугой.'),
                    };
                    errorMessage += `\n\n${label.total}: ${total}`;
                    if (active > 0) {
                        errorMessage += `\n${label.active}: ${active}`;
                    }
                    if (cancelled > 0) {
                        errorMessage += `\n${label.cancelled}: ${cancelled}`;
                    }
                    if (bookings && bookings.length > 0) {
                        errorMessage += `\n\n${label.examples}:`;
                        bookings.forEach((b: { id: string; status: string; client_name?: string }) => {
                            const base = `\n- ${label.booking} #${b.id.slice(0, 8)} (${b.status})`;
                            errorMessage += b.client_name ? `${base} - ${b.client_name}` : base;
                        });
                    }
                    errorMessage += `\n\n${label.hint}`;
                }

                toast.showError(errorMessage);
                return;
            }
            // A service with history is switched off instead of deleted (DB-14).
            toast.showSuccess(payload.archived
                ? t('services.delete.archived', 'По услуге уже были записи, поэтому она не удалена, а выключена: записаться на неё нельзя, история сохранена.')
                : t('services.delete.success', 'Услуга удалена'));
            setConfirmOpen(false);
            r.refresh();
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={loading}
                isLoading={loading}
                className="w-full sm:w-auto"
            >
                {loading ? t('services.delete.deleting', 'Удаляем…') : t('services.delete.button', 'Удалить')}
            </Button>
            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={onDelete}
                title={t('services.delete.confirmTitle', 'Удалить услугу?')}
                message={t('services.delete.confirm', 'Удалить услугу?')}
                confirmLabel={t('services.delete.button', 'Удалить')}
                cancelLabel={t('common.cancel', 'Отмена')}
                confirmVariant="danger"
                isLoading={loading}
            />
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}

