'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

type ApiOk = { ok: true };
type ApiErr = { ok: false; error?: string };
type DeleteResp = ApiOk | ApiErr;

type DeleteCategoryButtonProps = {
    id: string;
    name: string;
    usageCount: number;
};

export function DeleteCategoryButton({ id, name, usageCount }: DeleteCategoryButtonProps) {
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
            setForceDeleteFromBusinesses(false);
            router.refresh();
        } catch (deleteError) {
            const message = extractError(deleteError);
            setError(message);
            toast.showError(message);
        } finally {
            setLoading(false);
        }
    }

    function closeDialog() {
        setConfirmOpen(false);
        setForceDeleteFromBusinesses(false);
        setError(null);
    }

    return (
        <>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={loading}
                isLoading={loading}
                className="shrink-0 text-[var(--status-danger)]"
                leadingIcon={<Trash2 className="h-4 w-4" />}
            >
                {loading ? 'Удаляем…' : 'Удалить'}
            </Button>

            <ConfirmDialog
                open={confirmOpen}
                onClose={closeDialog}
                onConfirm={onDelete}
                title="Удалить категорию"
                description="Это действие нельзя отменить."
                message={
                    <div className="space-y-4">
                        <p className="type-body text-[var(--text-secondary)]">
                            Категория <strong className="text-[var(--text-primary)]">«{name}»</strong> будет удалена.
                        </p>
                        {error ? (
                            <p role="alert" className="rounded-lg bg-[var(--status-danger)]/10 p-3 text-sm text-[var(--status-danger)]">
                                {error}
                            </p>
                        ) : null}
                        {usageCount > 0 ? (
                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 p-3">
                                <input
                                    type="checkbox"
                                    checked={forceDeleteFromBusinesses}
                                    onChange={(event) => setForceDeleteFromBusinesses(event.target.checked)}
                                    className="mt-0.5 h-4 w-4 rounded border-[var(--border-default)] text-[var(--accent-primary)] focus:ring-[var(--focus-ring)]"
                                />
                                <span className="text-sm leading-5 text-[var(--text-secondary)]">
                                    Также убрать категорию из {usageCount}{' '}
                                    {usageCount === 1 ? 'бизнеса' : usageCount < 5 ? 'бизнесов' : 'бизнесов'}
                                </span>
                            </label>
                        ) : null}
                    </div>
                }
                confirmLabel="Удалить"
                cancelLabel="Отмена"
                confirmVariant="danger"
                isLoading={loading}
            />
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}

