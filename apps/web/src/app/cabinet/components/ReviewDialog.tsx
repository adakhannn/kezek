// apps/web/src/app/cabinet/components/ReviewDialog.tsx
'use client';

import { useState } from 'react';

export default function ReviewDialog({
                                         bookingId, onClose,
                                     }: { bookingId: string; onClose: () => void }) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit() {
        setBusy(true); setErr(null);
        try {
            const r = await fetch('/api/reviews/create', {
                method: 'POST',
                headers: { 'content-type':'application/json' },
                body: JSON.stringify({ booking_id: bookingId, rating, comment }),
            });
            const j = await r.json();
            if (!j.ok) return setErr(j.error || 'Не удалось отправить отзыв');
            onClose();
            location.reload();
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-[90vw] max-w-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="font-medium">Оставить отзыв</div>
                    <button className="text-sm underline" onClick={onClose}>Закрыть</button>
                </div>

                {err && <div className="text-red-600 text-sm">{err}</div>}

                <label className="block text-sm">Оценка</label>
                <select className="border rounded px-2 py-1 w-full"
                        value={rating}
                        onChange={e => setRating(Number(e.target.value))}>
                    {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} ★</option>)}
                </select>

                <label className="block text-sm">Комментарий (опционально)</label>
                <textarea
                    className="border rounded px-2 py-1 w-full min-h-24"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Что понравилось/что улучшить?"
                />

                <button disabled={busy} className="border rounded px-3 py-1"
                        onClick={submit}>
                    {busy ? 'Отправляю…' : 'Отправить'}
                </button>
            </div>
        </div>
    );
}
