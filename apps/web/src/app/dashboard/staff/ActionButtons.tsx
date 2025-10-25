'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ActionButtons({
                                          id,
                                          isActive,
                                      }: {
    id: string;
    isActive: boolean;
}) {
    const r = useRouter();
    const [busy, setBusy] = useState(false);

    async function call(path: string) {
        setBusy(true);
        try {
            const res = await fetch(path, { method: 'POST' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) {
                alert(json.error || `HTTP_${res.status}`);
                return;
            }
            // после увольнения — редирект на список, после восстановления — просто refresh
            if (path.endsWith('/dismiss')) {
                r.push('/dashboard/staff?dismissed=1');
            } else {
                r.refresh();
            }
        } finally {
            setBusy(false);
        }
    }

    if (isActive) {
        return (
            <div className="flex gap-2">
                <a className="underline" href={`/dashboard/staff/${id}`}>Редакт.</a>
                <button
                    disabled={busy}
                    className="underline text-red-600 disabled:opacity-50"
                    onClick={() => call(`/api/staff/${id}/dismiss`)}
                >
                    Уволить
                </button>
            </div>
        );
    }

    return (
        <div className="flex gap-2">
            <a className="underline" href={`/dashboard/staff/${id}`}>Редакт.</a>
            <button
                disabled={busy}
                className="underline text-green-700 disabled:opacity-50"
                onClick={() => call(`/api/staff/${id}/restore`)}
            >
                Восстановить
            </button>
        </div>
    );
}
