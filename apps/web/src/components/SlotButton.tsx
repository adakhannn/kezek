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
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            alert(msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <button 
            onClick={onClick} 
            disabled={loading} 
            className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm"
        >
            {loading ? (
                <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Загрузка...
                </span>
            ) : (
                label
            )}
        </button>
    );
}
