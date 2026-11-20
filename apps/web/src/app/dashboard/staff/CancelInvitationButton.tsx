'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

/** Cancels the pending invitation of a card (API-06); the card stays, without an account. */
export default function CancelInvitationButton({ staffId }: { staffId: string }) {
    const { t } = useLanguage();
    const router = useRouter();
    const toast = useToast();
    const [busy, setBusy] = useState(false);

    async function cancel() {
        setBusy(true);
        try {
            const res = await fetch(`/api/staff/${staffId}/invitation/cancel`, { method: 'POST' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) {
                toast.showError(json.message || json.error || `HTTP_${res.status}`);
                return;
            }
            router.refresh();
        } catch {
            toast.showError(t('staff.card.invitationCancelFailed', 'Не удалось отменить приглашение'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <>
            <button
                type="button"
                disabled={busy}
                onClick={cancel}
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-center text-xs font-medium text-amber-800 transition hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:bg-gray-800 dark:text-amber-300 dark:hover:bg-amber-950/20"
            >
                {busy ? '...' : t('staff.card.cancelInvitation', 'Отменить приглашение')}
            </button>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}
