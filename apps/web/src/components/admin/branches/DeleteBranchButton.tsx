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
                className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 transition-all duration-200"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Удаляю…
                    </>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Удалить
                    </>
                )}
            </button>
            {err && (
                <div className="text-xs text-red-600 dark:text-red-400 max-w-[28rem] p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                    {err}
                </div>
            )}
        </div>
    );
}
