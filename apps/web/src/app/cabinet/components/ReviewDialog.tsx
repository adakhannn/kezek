// apps/web/src/app/cabinet/components/ReviewDialog.tsx
'use client';

import { useState, useEffect } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type ReviewDialogProps = {
    bookingId: string;
    onClose: () => void;
    existingReview?: { id: string; rating: number; comment: string | null } | null;
    onReviewCreated?: (review: { id: string; rating: number; comment: string | null }) => void;
};

export default function ReviewDialog({
                                         bookingId, onClose, existingReview, onReviewCreated,
                                     }: ReviewDialogProps) {
    const { t } = useLanguage();
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
                if (!j.ok) {
                    setBusy(false);
                    return setErr(j.error || t('cabinet.review.error.update', 'Не удалось обновить отзыв'));
                }
                // Обновляем состояние через callback
                if (onReviewCreated) {
                    onReviewCreated({
                        id: existingReview.id,
                        rating,
                        comment: comment || null,
                    });
                }
            } else {
                // Создание нового отзыва (API автоматически обновит существующий, если он есть)
                const r = await fetch('/api/reviews/create', {
                    method: 'POST',
                    headers: { 'content-type':'application/json' },
                    body: JSON.stringify({ booking_id: bookingId, rating, comment }),
                });
                const j = await r.json();
                if (!j.ok) {
                    setBusy(false);
                    // Если отзыв уже существует, показываем понятное сообщение и обновляем состояние
                    if (j.error === 'REVIEW_ALREADY_EXISTS') {
                        setErr(t('cabinet.review.error.alreadyExists', 'Отзыв для этой записи уже существует. Обновляю страницу...'));
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                        return;
                    }
                    return setErr(j.error || t('cabinet.review.error.submit', 'Не удалось отправить отзыв'));
                }
                
                // Если отзыв был создан или обновлен, вызываем callback для оптимистичного обновления
                if (j.id && onReviewCreated) {
                    onReviewCreated({
                        id: j.id,
                        rating,
                        comment: comment || null,
                    });
                }
            }
            onClose();
            // Перезагружаем страницу для синхронизации с сервером
            setTimeout(() => {
                window.location.reload();
            }, 300);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 sm:px-6">
            {/* Клик по фону закрывает модалку */}
            <div
                className="absolute inset-0"
                onClick={onClose}
                aria-hidden="true"
            />

            <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-800 dark:bg-gray-900 space-y-4">
                {/* Заголовок */}
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {existingReview ? t('cabinet.review.edit', 'Редактировать отзыв') : t('cabinet.review.create', 'Оставить отзыв')}
                        </h2>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t('cabinet.review.description', 'Оцените визит и, при желании, напишите пару слов для владельца.')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        aria-label={t('cabinet.review.close', 'Закрыть')}
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {err && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                        {err}
                    </div>
                )}

                {/* Оценка */}
                <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                        {t('cabinet.review.rating', 'Оценка')}
                    </label>
                    <select
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={rating}
                        onChange={(e) => setRating(Number(e.target.value))}
                    >
                        {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>
                                {n} ★
                            </option>
                        ))}
                    </select>
                </div>

                {/* Комментарий */}
                <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                        {t('cabinet.review.comment', 'Комментарий')} <span className="text-gray-400 text-xs">({t('cabinet.review.optional', 'опционально')})</span>
                    </label>
                    <textarea
                        className="min-h-[96px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t('cabinet.review.commentPlaceholder', 'Что понравилось, что можно улучшить?')}
                    />
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {t('cabinet.review.commentHint', 'Комментарий увидит только владелец заведения. Он помогает улучшать сервис.')}
                    </p>
                </div>

                {/* Кнопки */}
                <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                        {t('cabinet.review.cancel', 'Отмена')}
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={submit}
                        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {busy
                            ? existingReview
                                ? t('cabinet.review.updating', 'Обновляю…')
                                : t('cabinet.review.sending', 'Отправляю…')
                            : existingReview
                            ? t('cabinet.review.update', 'Обновить отзыв')
                            : t('cabinet.review.submit', 'Отправить отзыв')}
                    </button>
                </div>
            </div>
        </div>
    );
}
