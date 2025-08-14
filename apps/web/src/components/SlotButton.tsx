'use client';
import { useState } from 'react';

export type QuickPayload = {
    biz_id: string;
    service_id: string;
    staff_id: string;
    start_at: string; // ISO
    slug: string;
};

export default function SlotButton({
                                       label,
                                       payload,
                                       redirectBase = '/booking',
                                   }: {
    label: string;
    payload: QuickPayload;
    redirectBase?: string;
}) {
    const [loading, setLoading] = useState(false);

    async function onClick() {
        if (loading) return;
        setLoading(true);
        try {
            const res = await fetch('/api/quick-hold', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.status === 401) {
                window.location.href = `/b/${payload.slug}`;
                return;
            }
            const data: { ok: boolean; booking_id?: string; error?: string; message?: string } = await res.json();
            if (!data.ok || !data.booking_id) throw new Error(data.message || data.error || 'Ошибка');
            window.location.href = `${redirectBase}/${data.booking_id}`;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            alert(msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <button onClick={onClick} disabled={loading} className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50">
            {label}
        </button>
    );
}
