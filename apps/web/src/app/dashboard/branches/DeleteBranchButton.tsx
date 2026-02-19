'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

export default function DeleteBranchButton({ id }: { id: string }) {
    const r = useRouter();
    const { t } = useLanguage();
    const toast = useToast();
    const [loading, setLoading] = useState(false);

    async function onDelete() {
        if (!confirm(t('branches.delete.confirm', 'Удалить филиал? Будет отказано, если есть сотрудники/брони.'))) return;
        try {
            setLoading(true);
            const res = await fetch(`/api/branches/${encodeURIComponent(id)}/delete`, { method: 'POST' });
            const text = await res.text();
            let payload;
            try { payload = JSON.parse(text); } catch { payload = { ok: false, error: text || 'NON_JSON_RESPONSE' }; }
            if (!res.ok || !payload.ok) {
                let errorMessage = payload.message || payload.error || `HTTP_${res.status}`;
                
                // Если есть детали о бронях, добавляем их к сообщению
                if (payload.details && payload.error === 'HAS_BOOKINGS') {
                    const { total, active, cancelled, bookings } = payload.details;
                    errorMessage += `\n\n${t('branches.delete.error.totalBookings', 'Всего броней:')} ${total}`;
                    if (active > 0) errorMessage += `\n${t('branches.delete.error.activeBookings', 'Активных:')} ${active}`;
                    if (cancelled > 0) errorMessage += `\n${t('branches.delete.error.cancelledBookings', 'Отменённых:')} ${cancelled}`;
                    if (bookings && bookings.length > 0) {
                        errorMessage += `\n\n${t('branches.delete.error.examples', 'Примеры броней:')}`;
                        bookings.forEach((b: { id: string; status: string; client_name?: string }) => {
                            errorMessage += `\n- ${t('branches.delete.error.bookingExample', 'Бронь #')}${b.id.slice(0, 8)} (${b.status})${b.client_name ? ` - ${b.client_name}` : ''}`;
                        });
                    }
                    errorMessage += `\n\n${t('branches.delete.error.firstCancel', 'Сначала отмените или удалите все брони, связанные с этим филиалом.')}`;
                }
                
                toast.showError(errorMessage);
                return;
            }
            // Редирект на список филиалов после успешного удаления
            r.push('/dashboard/branches');
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
            >
                {loading ? t('branches.delete.deleting', 'Удаляем…') : t('branches.delete.button', 'Удалить')}
            </Button>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}
