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
}: {
    bizId: string;
    branchId: string;
    name: string;
}) {
    const router = useRouter();
    const toast = useToast();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    function extractError(value: unknown): string {
        return value instanceof Error ? value.message : String(value);
    }

    async function onDelete() {
        setError(null);
        setLoading(true);
        try {
            const response = await fetch(`/admin/api/businesses/${bizId}/branches/${branchId}/delete`, {
                method: 'POST',
                credentials: 'include',
            });

            const contentType = response.headers.get('content-type') ?? '';
            let data: DeleteResp | null = null;

            if (contentType.includes('application/json')) {
                data = (await response.json()) as DeleteResp;
            } else {
                const text = await response.text();
                if (!response.ok) throw new Error(text.slice(0, 2000));
                data = { ok: true };
            }

            if (!response.ok || !data?.ok) {
                const apiError = data && 'error' in data ? data.error : `HTTP ${response.status}`;
                throw new Error(apiError || `HTTP ${response.status}`);
            }

            toast.showSuccess('Филиал удален.');
            setConfirmOpen(false);
            router.refresh();
        } catch (deleteError) {
            const message = extractError(deleteError);
            setError(message);
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
                {loading ? 'Удаляем…' : 'Удалить'}
            </Button>
            {error ? <AlertBanner variant="danger" message={error} compact /> : null}
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

