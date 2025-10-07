'use client';

import {useRouter} from 'next/navigation';
import {useState} from 'react';

type ApiOk = { ok: true };
type ApiErr = { ok: false; error?: string };
type DeleteResp = ApiOk | ApiErr;

export function DeleteBizButton({bizId, bizName}: { bizId: string; bizName: string }) {
    const router = useRouter();
    const [err, setErr] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function extractError(e: unknown): string {
        return e instanceof Error ? e.message : String(e);
    }

    async function onDelete() {
        setErr(null);
        if (!confirm(`Удалить бизнес «${bizName}» вместе со всеми данными? Это действие необратимо.`)) return;
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
                data = {ok: true};
            }

            if (!resp.ok || !('ok' in data) || !data.ok) {
                const apiErr = (data && 'error' in data ? (data as ApiErr).error : undefined) ?? `HTTP ${resp.status}`;
                throw new Error(apiErr);
            }

            router.push('/admin/businesses');
            router.refresh();
        } catch (e: unknown) {
            setErr(extractError(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-2">
            <button
                type="button"
                className="border border-red-600 text-red-600 rounded px-3 py-2 hover:bg-red-50 disabled:opacity-60"
                onClick={onDelete}
                disabled={loading}
                aria-busy={loading}
            >
                {loading ? 'Удаляю…' : 'Удалить бизнес'}
            </button>
            {err && <div className="text-sm text-red-600">{err}</div>}
        </div>
    );
}

