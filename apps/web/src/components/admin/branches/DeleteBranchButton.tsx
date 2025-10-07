// apps/web/src/components/admin/branches/DeleteBranchButton.tsx
'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';

type ApiOk = { ok: true };
type ApiErr = { ok: false; error?: string };
type DeleteResp = ApiOk | ApiErr;

export function DeleteBranchButton({
                                       bizId,
                                       branchId,
                                       name,
                                   }: { bizId: string; branchId: string; name: string }) {
    const router = useRouter();
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function extractError(e: unknown): string {
        return e instanceof Error ? e.message : String(e);
    }

    async function onDelete() {
        setErr(null);
        if (!confirm(`Удалить филиал «${name}»? Это действие необратимо.`)) return;
        setLoading(true);
        try {
            const resp = await fetch(
                `/admin/api/businesses/${bizId}/branches/${branchId}/delete`,
                {method: 'POST', credentials: 'include'}
            );

            const ct = resp.headers.get('content-type') ?? '';
            let data: DeleteResp | null = null;

            if (ct.includes('application/json')) {
                data = (await resp.json()) as DeleteResp;
            } else {
                const text = await resp.text();
                if (!resp.ok) throw new Error(text.slice(0, 2000));
                data = {ok: true};
            }

            if (!resp.ok || !('ok' in data) || !data.ok) {
                const apiErr = (data && 'error' in data ? (data as ApiErr).error : undefined) ?? `HTTP ${resp.status}`;
                throw new Error(apiErr);
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
            <button
                type="button"
                onClick={onDelete}
                disabled={loading}
                aria-busy={loading}
                className="border border-red-600 text-red-600 rounded px-2 py-1 hover:bg-red-50 text-sm disabled:opacity-60"
            >
                {loading ? 'Удаляю…' : 'Удалить'}
            </button>
            {err && <div className="text-xs text-red-600 max-w-[28rem]">{err}</div>}
        </div>
    );
}
