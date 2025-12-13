'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';

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
                let errorMessage = payload.message || payload.error || `HTTP_${res.status}`;
                
                // Если есть детали о бронях, добавляем их к сообщению
                if (payload.details && payload.error === 'HAS_BOOKINGS') {
                    const { total, active, cancelled, bookings } = payload.details;
                    errorMessage += `\n\nВсего броней: ${total}`;
                    if (active > 0) errorMessage += `\nАктивных: ${active}`;
                    if (cancelled > 0) errorMessage += `\nОтменённых: ${cancelled}`;
                    if (bookings && bookings.length > 0) {
                        errorMessage += `\n\nПримеры броней:`;
                        bookings.forEach((b: { id: string; status: string; client_name?: string }) => {
                            errorMessage += `\n- Бронь #${b.id.slice(0, 8)} (${b.status})${b.client_name ? ` - ${b.client_name}` : ''}`;
                        });
                    }
                    errorMessage += `\n\nСначала отмените или удалите все брони, связанные с этой услугой.`;
                }
                
                alert(errorMessage);
                return;
            }
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
