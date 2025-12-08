// apps/web/src/app/cabinet/components/ReviewDialog.tsx
'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';

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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-800 p-6 space-y-5 animate-fade-in">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Оставить отзыв</h3>
                    <button
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        onClick={onClose}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {err && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Оценка</label>
                    <select
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                        value={rating}
                        onChange={e => setRating(Number(e.target.value))}
                    >
                        {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} ★</option>)}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Комментарий (опционально)</label>
                    <textarea
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 min-h-24 resize-none"
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        placeholder="Что понравилось/что улучшить?"
                    />
                </div>

                <div className="pt-2">
                    <Button
                        disabled={busy}
                        onClick={submit}
                        isLoading={busy}
                        className="w-full"
                    >
                        {busy ? 'Отправляю…' : 'Отправить'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
