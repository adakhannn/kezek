// apps/web/src/app/cabinet/components/ReviewDialog.tsx
'use client';

import { useState, useEffect, useId } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Dialog } from '@/components/ui/Dialog';

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
    const ratingId = useId();
    const commentId = useId();
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
        <Dialog
            open
            onClose={onClose}
            title={existingReview ? t('cabinet.review.edit', 'Редактировать отзыв') : t('cabinet.review.create', 'Оставить отзыв')}
            description={t('cabinet.review.description', 'Оцените визит и, при желании, напишите пару слов для владельца.')}
            size="sm"
        >
            <div className="space-y-4">
                {err ? <AlertBanner variant="danger" message={err} compact /> : null}

                {/* Оценка */}
                <div className="space-y-1">
                    <label htmlFor={ratingId} className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                        {t('cabinet.review.rating', 'Оценка')}
                    </label>
                    <select
                        id={ratingId}
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
                    <label htmlFor={commentId} className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                        {t('cabinet.review.comment', 'Комментарий')} <span className="text-gray-400 text-xs">({t('cabinet.review.optional', 'опционально')})</span>
                    </label>
                    <textarea
                        id={commentId}
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
        </Dialog>
    );
}


