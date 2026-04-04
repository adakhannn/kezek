'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

type ApiOk = { ok: true };
type ApiErr = { ok: false; error?: string };
type DeleteResp = ApiOk | ApiErr;

export function DeleteBranchButton({
    bizId,
    branchId,
    name,
}: { bizId: string; branchId: string; name: string }) {
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
            const resp = await fetch(
                `/admin/api/businesses/${bizId}/branches/${branchId}/delete`,
                { method: 'POST', credentials: 'include' }
            );

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

            toast.showSuccess('Филиал удален.');
            setConfirmOpen(false);
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
        <div className="flex flex-col gap-2">
            <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={loading}
                isLoading={loading}
            >
                {loading ? 'Удаляю…' : 'Удалить'}
            </Button>
            {err ? <AlertBanner variant="danger" message={err} compact /> : null}
            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={onDelete}
                title="Удалить филиал"
                message={`Удалить филиал «${name}»? Это действие необратимо.`}
                confirmLabel="Удалить"
                cancelLabel="Отмена"
                confirmVariant="danger"
                isLoading={loading}
            />
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
    );
}


