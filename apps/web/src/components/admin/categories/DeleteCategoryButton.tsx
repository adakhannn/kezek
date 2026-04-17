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

export function DeleteCategoryButton({ id, slug }: { id: string; slug: string }) {
    const router = useRouter();
    const toast = useToast();
    const [forceDeleteFromBusinesses, setForceDeleteFromBusinesses] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    function extractError(value: unknown) {
        return value instanceof Error ? value.message : String(value);
    }

    async function onDelete() {
        setError(null);
        setLoading(true);
        try {
            const response = await fetch(`/admin/api/categories/${id}/delete`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ force: forceDeleteFromBusinesses }),
            });

            const contentType = response.headers.get('content-type') ?? '';
            let data: DeleteResp | null = null;

            if (contentType.includes('application/json')) {
                data = (await response.json()) as DeleteResp;
            } else {
                const text = await response.text();
                if (!response.ok) throw new Error(text.slice(0, 1500));
                data = { ok: true };
            }

            if (!response.ok || !data?.ok) {
                const apiError = data && 'error' in data ? data.error : `HTTP ${response.status}`;
                throw new Error(apiError || `HTTP ${response.status}`);
            }

            toast.showSuccess('Категория удалена.');
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
            <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                    type="checkbox"
                    checked={forceDeleteFromBusinesses}
                    onChange={(event) => setForceDeleteFromBusinesses(event.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border-default)] text-[var(--accent-primary)] focus:ring-[var(--focus-ring)]"
                />
                Удалить категорию из всех бизнесов
            </label>

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
                title="Удалить категорию"
                message={`Удалить категорию «${slug}»?`}
                confirmLabel="Удалить"
                cancelLabel="Отмена"
                confirmVariant="danger"
                isLoading={loading}
            />
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </div>
    );
}

