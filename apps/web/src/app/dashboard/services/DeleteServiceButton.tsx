'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DeleteServiceButton({ id }: { id: string }) {
    const r = useRouter();
    const [loading, setLoading] = useState(false);

    async function onDelete() {
        if (!confirm('Удалить услугу?')) return;
        try {
            setLoading(true);
            const res = await fetch(`/api/services/${encodeURIComponent(id)}/delete`, { method: 'POST' });
            const payload = await res.json().catch(() => ({ ok: false, error: 'NON_JSON_RESPONSE' }));
            if (!res.ok || !payload.ok) {
                alert(payload.error ?? `HTTP_${res.status}`);
                return;
            }
            r.refresh();
        } finally {
            setLoading(false);
        }
    }

    return (
        <button type="button" className="border rounded px-2 py-1" onClick={onDelete} disabled={loading}>
            {loading ? 'Удаляем…' : 'Удалить'}
        </button>
    );
}
