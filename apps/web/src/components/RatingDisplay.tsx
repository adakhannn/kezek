'use client';

type RatingDisplayProps = {
    /** Рейтинг 0–100 или null (не инициализирован). */
    score: number | null | undefined;
    /** Функция перевода (ключ → строка). */
    t: (key: string, fallback?: string) => string;
    /** Показывать подпись «низкий рейтинг» при score 0–10. */
    showLowHint?: boolean;
    /** Вариант оформления. */
    variant?: 'badge' | 'inline';
    className?: string;
};

/**
 * Отображает рейтинг с учётом семантики: NULL = «Нет рейтинга», 0–10 = низкий рейтинг (с опциональной подписью).
 */
export function RatingDisplay({
    score,
    t,
    showLowHint = false,
    variant = 'badge',
    className = '',
}: RatingDisplayProps) {
    const isNull = score === null || score === undefined;
    const isLow = typeof score === 'number' && score <= 10;

    if (isNull) {
        const label = t('common.rating.noRating', 'Нет рейтинга');
        if (variant === 'badge') {
            return (
                <div
                    className={
                        'inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 dark:border-gray-700 dark:bg-gray-800 ' +
                        className
                    }
                >
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
                </div>
            );
        }
        return (
            <span className={'text-xs text-gray-500 dark:text-gray-400 ' + className}>{label}</span>
        );
    }

    const value = Number(score);
    const badgeClasses =
        variant === 'badge'
            ? 'inline-flex items-center gap-1 rounded-lg border px-2 py-1 ' +
              (isLow
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30'
                  : 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:border-amber-800 dark:from-amber-900/20 dark:to-orange-900/20')
            : '';

    return (
        <span className={className}>
            <span className={badgeClasses || undefined}>
                {variant === 'badge' && (
                    <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                )}
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{value.toFixed(1)}</span>
            </span>
            {showLowHint && isLow && (
                <span className="ml-1 text-[10px] text-amber-600 dark:text-amber-400">
                    ({t('common.rating.lowRatingHint', 'низкий рейтинг')})
                </span>
            )}
        </span>
    );
}
