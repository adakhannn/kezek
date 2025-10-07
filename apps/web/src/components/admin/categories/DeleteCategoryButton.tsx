'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';

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
            <label className="inline-flex items-center gap-2 text-xs">
                <input
                    type="checkbox"
                    checked={force}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForce(e.target.checked)}
                />
                Также удалить категорию из всех бизнесов
            </label>

            <button
                type="button"
                className="border border-red-600 text-red-600 rounded px-2 py-1 hover:bg-red-50 text-sm disabled:opacity-60"
                onClick={onDelete}
                disabled={loading}
                aria-disabled={loading}
                aria-busy={loading}
            >
                {loading ? 'Удаляю…' : 'Удалить'}
            </button>

            {err && <div className="text-xs text-red-600 max-w-[28rem]">{err}</div>}
        </div>
    );
}
