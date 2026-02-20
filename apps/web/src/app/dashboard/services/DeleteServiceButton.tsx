'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

export default function DeleteServiceButton({ id }: { id: string }) {
    const { t } = useLanguage();
    const r = useRouter();
    const toast = useToast();
    const [loading, setLoading] = useState(false);

    async function onDelete() {
        if (!confirm(t('services.delete.confirm', 'Удалить услугу?'))) return;
        try {
            setLoading(true);
            const res = await fetch(`/api/services/${encodeURIComponent(id)}/delete`, { method: 'POST' });
            const payload = await res.json().catch(() => ({ ok: false, error: 'NON_JSON_RESPONSE' }));
            if (!res.ok || !payload.ok) {
                let errorMessage = payload.message || payload.error || `HTTP_${res.status}`;
                
                // Если есть детали о бронях, добавляем их к сообщению
                if (payload.details && payload.error === 'HAS_BOOKINGS') {
                    const { total, active, cancelled, bookings } = payload.details;
                    errorMessage += `\n\n${t('services.delete.totalBookings', 'Всего броней')}: ${total}`;
                    if (active > 0) {
                        errorMessage += `\n${t('services.delete.activeBookings', 'Активных')}: ${active}`;
                    }
                    if (cancelled > 0) {
                        errorMessage += `\n${t('services.delete.cancelledBookings', 'Отменённых')}: ${cancelled}`;
                    }
                    if (bookings && bookings.length > 0) {
                        errorMessage += `\n\n${t('services.delete.examples', 'Примеры броней')}:`;
                        bookings.forEach((b: { id: string; status: string; client_name?: string }) => {
                            const base = `\n- ${t('services.delete.bookingPrefix', 'Бронь')} #${b.id.slice(0, 8)} (${b.status})`;
                            errorMessage += b.client_name ? `${base} - ${b.client_name}` : base;
                        });
                    }
                    errorMessage += `\n\n${t(
                        'services.delete.hint',
                        'Сначала отмените или удалите все брони, связанные с этой услугой.'
                    )}`;
                }
                
                toast.showError(errorMessage);
                return;
            }
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
                onClick={onDelete}
                disabled={loading}
                isLoading={loading}
                className="w-full sm:w-auto"
            >
                {loading ? t('services.delete.deleting', 'Удаляем…') : t('services.delete.button', 'Удалить')}
            </Button>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}
