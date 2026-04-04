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
    const [force, setForce] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    function extractError(e: unknown) {
        return e instanceof Error ? e.message : String(e);
    }

    async function onDelete() {
        setErr(null);
        setLoading(true);
        try {
            const resp = await fetch(`/admin/api/categories/${id}/delete`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ force }),
            });

            const ct = resp.headers.get('content-type') ?? '';
            let data: DeleteResp | null = null;

            if (ct.includes('application/json')) {
                data = (await resp.json()) as DeleteResp;
            } else {
                const text = await resp.text();
                if (!resp.ok) throw new Error(text.slice(0, 1500));
                data = { ok: true };
            }

            if (!resp.ok || !('ok' in data) || !data.ok) {
                throw new Error(('error' in (data ?? {}) && (data as ApiErr).error) || `HTTP ${resp.status}`);
            }

            toast.showSuccess('Категория удалена.');
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
            <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <input
                    type="checkbox"
                    checked={force}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForce(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                Также удалить категорию из всех бизнесов
            </label>

            <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={loading}
                isLoading={loading}
            >
                Удалить
            </Button>

            {err ? <AlertBanner variant="danger" message={err} compact /> : null}
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


