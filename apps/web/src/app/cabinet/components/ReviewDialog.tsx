// apps/web/src/app/cabinet/components/ReviewDialog.tsx
'use client';

import { useState, useEffect } from 'react';

type ReviewDialogProps = {
    bookingId: string;
    onClose: () => void;
    existingReview?: { id: string; rating: number; comment: string | null } | null;
    onReviewCreated?: (review: { id: string; rating: number; comment: string | null }) => void;
};

export default function ReviewDialog({
                                         bookingId, onClose, existingReview, onReviewCreated,
                                     }: ReviewDialogProps) {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (existingReview) {
            setRating(existingReview.rating);
            setComment(existingReview.comment || '');
        }
    }, [existingReview]);

    async function submit() {
        setBusy(true); setErr(null);
        try {
            if (existingReview) {
                // Обновление существующего отзыва
                const r = await fetch('/api/reviews/update', {
                    method: 'POST',
                    headers: { 'content-type':'application/json' },
                    body: JSON.stringify({ review_id: existingReview.id, rating, comment }),
                });
                const j = await r.json();
                if (!j.ok) return setErr(j.error || 'Не удалось обновить отзыв');
            } else {
                // Создание нового отзыва
                const r = await fetch('/api/reviews/create', {
                    method: 'POST',
                    headers: { 'content-type':'application/json' },
                    body: JSON.stringify({ booking_id: bookingId, rating, comment }),
                });
                const j = await r.json();
                if (!j.ok) {
                    setBusy(false);
                    return setErr(j.error || 'Не удалось отправить отзыв');
                }
                
                // Если отзыв был создан, вызываем callback для оптимистичного обновления
                if (j.id && onReviewCreated) {
                    onReviewCreated({
                        id: j.id,
                        rating,
                        comment: comment || null,
                    });
                    // Перезагружаем страницу через небольшую задержку для синхронизации с сервером
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                    return;
                }
            }
            onClose();
            // Для обновления существующего отзыва просто перезагружаем страницу
            setTimeout(() => {
                window.location.reload();
            }, 300);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-[90vw] max-w-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="font-medium">{existingReview ? 'Редактировать отзыв' : 'Оставить отзыв'}</div>
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
                    {busy ? (existingReview ? 'Обновляю…' : 'Отправляю…') : (existingReview ? 'Обновить' : 'Отправить')}
                </button>
            </div>
        </div>
    );
}
