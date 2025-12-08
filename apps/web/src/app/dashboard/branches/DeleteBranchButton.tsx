'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';

export default function DeleteBranchButton({ id }: { id: string }) {
    const r = useRouter();
    const [loading, setLoading] = useState(false);

    async function onDelete() {
        if (!confirm('Удалить филиал? Будет отказано, если есть сотрудники/брони.')) return;
        try {
            setLoading(true);
            const res = await fetch(`/api/branches/${encodeURIComponent(id)}/delete`, { method: 'POST' });
            const text = await res.text();
            let payload;
            try { payload = JSON.parse(text); } catch { payload = { ok: false, error: text || 'NON_JSON_RESPONSE' }; }
            if (!res.ok || !payload.ok) {
                alert(payload.error ?? `HTTP_${res.status}`);
                return;
            }
            // Обновляем список после удаления
            r.refresh();
        } finally {
            setLoading(false);
        }
    }

    return (
        <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onDelete}
            disabled={loading}
            isLoading={loading}
        >
            {loading ? 'Удаляем…' : 'Удалить'}
        </Button>
    );
}
