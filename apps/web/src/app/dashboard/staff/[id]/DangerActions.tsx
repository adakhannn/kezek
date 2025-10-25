'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DangerActions({ staffId }: { staffId: string }) {
    const r = useRouter();
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function dismiss() {
        if (!confirm('Уволить сотрудника? Будущие записи должны быть отменены заранее.')) return;
        setBusy(true); setErr(null);
        try {
            const res = await fetch(`/api/staff/${encodeURIComponent(staffId)}/dismiss`, { method: 'POST' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) {
                setErr(json.error || `HTTP_${res.status}`);
                return;
            }
            // ✅ успешное увольнение — сразу на список сотрудников
            r.push('/dashboard/staff?dismissed=1');
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="border rounded p-3 bg-red-50 border-red-300">
            <div className="font-medium text-red-800 mb-2">Опасная зона</div>
            {err && <div className="text-sm text-red-700 mb-2">{err}</div>}
            <button
                disabled={busy}
                onClick={dismiss}
                className="px-3 py-1 border rounded bg-white hover:bg-red-100"
            >
                {busy ? 'Выполняем…' : 'Уволить сотрудника'}
            </button>
            <p className="text-xs text-red-700 mt-2">
                Будущие записи не должны существовать. Права в бизнесе будут сохранены только как «client».
            </p>
        </div>
    );
}
