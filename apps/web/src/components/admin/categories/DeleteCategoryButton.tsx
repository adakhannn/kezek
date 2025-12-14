'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';

import { Button } from '@/components/ui/Button';

type ApiOk = { ok: true };
type ApiErr = { ok: false; error?: string };
type DeleteResp = ApiOk | ApiErr;

export function DeleteCategoryButton({id, slug}: { id: string; slug: string }) {
    const router = useRouter();
    const [force, setForce] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function extractError(e: unknown) {
        return e instanceof Error ? e.message : String(e);
    }

    async function onDelete() {
        setErr(null);
        if (!confirm(`Удалить категорию «${slug}»?`)) return;
        setLoading(true);
        try {
            const resp = await fetch(`/admin/api/categories/${id}/delete`, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({force}),
            });

            const ct = resp.headers.get('content-type') ?? '';
            let data: DeleteResp | null = null;

            if (ct.includes('application/json')) {
                data = (await resp.json()) as DeleteResp;
            } else {
                const text = await resp.text();
                if (!resp.ok) throw new Error(text.slice(0, 1500));
                // если всё ок и не JSON — считаем успешным
                data = {ok: true};
            }

            if (!resp.ok || !('ok' in data) || !data.ok) {
                throw new Error(('error' in (data ?? {}) && (data as ApiErr).error) || `HTTP ${resp.status}`);
            }

            router.refresh();
        } catch (e: unknown) {
            setErr(extractError(e));
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
                onClick={onDelete}
                disabled={loading}
                isLoading={loading}
            >
                Удалить
            </Button>

            {err && (
                <div className="text-xs text-red-600 dark:text-red-400 max-w-[28rem] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                    {err}
                </div>
            )}
        </div>
    );
}
