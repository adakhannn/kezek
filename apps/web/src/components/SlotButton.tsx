'use client';
import {useState} from 'react';

export default function SlotButton({
                                       label, payload, redirectBase = '/booking'
                                   }: {
    label: string;
    payload: { biz_id: string; service_id: string; staff_id: string; start_at: string; slug: string };
    redirectBase?: string;
}) {
    const [loading, setLoading] = useState(false);

    async function onClick() {
        if (loading) return;
        setLoading(true);
        try {
            const res = await fetch('/api/quick-hold', {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify(payload),
            });
            if (res.status === 401) {
                // не авторизован — отправим на карточку бизнеса с панелью входа
                window.location.href = `/b/${payload.slug}`;
                return;
            }
            const data = await res.json();
            if (!data.ok) throw new Error(data.message || 'Ошибка');
            window.location.href = `${redirectBase}/${data.booking_id}`;
        } catch (e: any) {
            alert(e.message || e);
        } finally {
            setLoading(false);
        }
    }

    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
            title="Быстрая запись"
        >
            {label}
        </button>
    );
}
