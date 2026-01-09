'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export default function ActionButtons({
                                          id,
                                          isActive,
                                      }: {
    id: string;
    isActive: boolean;
}) {
    const { t } = useLanguage();
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
            <button
                disabled={busy}
                onClick={() => call(`/api/staff/${id}/dismiss`)}
                className="flex-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-center text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/20"
            >
                {busy ? '...' : t('staff.actions.dismiss', 'Уволить')}
            </button>
        );
    }

    return (
        <button
            disabled={busy}
            onClick={() => call(`/api/staff/${id}/restore`)}
            className="flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-center text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:bg-gray-800 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
        >
            {busy ? '...' : t('staff.actions.restore', 'Восстановить')}
        </button>
    );
}
