'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

type ApiOk = { ok: true };
type ApiErr = { ok: false; error?: string };
type DeleteResp = ApiOk | ApiErr;

export function DeleteBizButton({ bizId, bizName }: { bizId: string; bizName: string }) {
    const router = useRouter();
    const toast = useToast();
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    function extractError(e: unknown): string {
        return e instanceof Error ? e.message : String(e);
    }

    async function onDelete() {
        setErr(null);
        setLoading(true);
        try {
            const resp = await fetch(`/admin/api/businesses/${bizId}/delete`, {
                method: 'POST',
                credentials: 'include',
            });

            const ct = resp.headers.get('content-type') ?? '';
            let data: DeleteResp | null = null;

            if (ct.includes('application/json')) {
                data = (await resp.json()) as DeleteResp;
            } else {
                const text = await resp.text();
                if (!resp.ok) throw new Error(text.slice(0, 2000));
                data = { ok: true };
            }

            if (!resp.ok || !('ok' in data) || !data.ok) {
                const apiErr = (data && 'error' in data ? (data as ApiErr).error : undefined) ?? `HTTP ${resp.status}`;
                throw new Error(apiErr);
            }

            toast.showSuccess('Бизнес удален.');
            setConfirmOpen(false);
            router.push('/admin/businesses');
            router.refresh();
        } catch (e: unknown) {
            const message = extractError(e);
            setErr(message);
            toast.showError(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-2">
            <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={loading}
                isLoading={loading}
            >
                {loading ? 'Удаляю…' : 'Удалить бизнес'}
            </Button>
            {err && <div className="text-sm text-red-600">{err}</div>}
            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={onDelete}
                title="Удалить бизнес"
                message={`Удалить бизнес «${bizName}» вместе со всеми данными? Это действие необратимо.`}
                confirmLabel="Удалить"
                cancelLabel="Отмена"
                confirmVariant="danger"
                isLoading={loading}
            />
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
    );
}
