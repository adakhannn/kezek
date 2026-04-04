'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

export default function DeleteBranchButton({ id }: { id: string }) {
    const r = useRouter();
    const { t } = useLanguage();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    async function onDelete() {
        try {
            setLoading(true);
            const res = await fetch(`/api/branches/${encodeURIComponent(id)}/delete`, { method: 'POST' });
            const text = await res.text();
            let payload;
            try {
                payload = JSON.parse(text);
            } catch {
                payload = { ok: false, error: text || 'NON_JSON_RESPONSE' };
            }
            if (!res.ok || !payload.ok) {
                let errorMessage = payload.message || payload.error || `HTTP_${res.status}`;

                if (payload.details && payload.error === 'HAS_BOOKINGS') {
                    const { total, active, cancelled, bookings } = payload.details;
                    errorMessage += `\n\n${t('branches.delete.error.totalBookings', 'Р’СЃРµРіРѕ Р±СЂРѕРЅРµР№:')} ${total}`;
                    if (active > 0) errorMessage += `\n${t('branches.delete.error.activeBookings', 'РђРєС‚РёРІРЅС‹С…:')} ${active}`;
                    if (cancelled > 0) errorMessage += `\n${t('branches.delete.error.cancelledBookings', 'РћС‚РјРµРЅС‘РЅРЅС‹С…:')} ${cancelled}`;
                    if (bookings && bookings.length > 0) {
                        errorMessage += `\n\n${t('branches.delete.error.examples', 'РџСЂРёРјРµСЂС‹ Р±СЂРѕРЅРµР№:')}`;
                        bookings.forEach((b: { id: string; status: string; client_name?: string }) => {
                            errorMessage += `\n- ${t('branches.delete.error.bookingExample', 'Р‘СЂРѕРЅСЊ #')}${b.id.slice(0, 8)} (${b.status})${b.client_name ? ` - ${b.client_name}` : ''}`;
                        });
                    }
                    errorMessage += `\n\n${t('branches.delete.error.firstCancel', 'РЎРЅР°С‡Р°Р»Р° РѕС‚РјРµРЅРёС‚Рµ РёР»Рё СѓРґР°Р»РёС‚Рµ РІСЃРµ Р±СЂРѕРЅРё, СЃРІСЏР·Р°РЅРЅС‹Рµ СЃ СЌС‚РёРј С„РёР»РёР°Р»РѕРј.')}`;
                }

                toast.showError(errorMessage);
                return;
            }
            toast.showSuccess(t('branches.delete.success', 'Р¤РёР»РёР°Р» СѓРґР°Р»РµРЅ'));
            setConfirmOpen(false);
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
                onClick={() => setConfirmOpen(true)}
                disabled={loading}
                isLoading={loading}
            >
                {loading ? t('branches.delete.deleting', 'РЈРґР°Р»СЏРµРјвЂ¦') : t('branches.delete.button', 'РЈРґР°Р»РёС‚СЊ')}
            </Button>
            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={onDelete}
                title={t('branches.delete.confirmTitle', 'РЈРґР°Р»РёС‚СЊ С„РёР»РёР°Р»?')}
                message={t('branches.delete.confirm', 'РЈРґР°Р»РёС‚СЊ С„РёР»РёР°Р»? Р‘СѓРґРµС‚ РѕС‚РєР°Р·Р°РЅРѕ, РµСЃР»Рё РµСЃС‚СЊ СЃРѕС‚СЂСѓРґРЅРёРєРё/Р±СЂРѕРЅРё.')}
                confirmLabel={t('branches.delete.button', 'РЈРґР°Р»РёС‚СЊ')}
                cancelLabel={t('common.cancel', 'РћС‚РјРµРЅР°')}
                confirmVariant="danger"
                isLoading={loading}
            />
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}
