type TranslationFn = (key: string, fallback: string) => string;

export function getRatingAdvice(effectiveRatingScore: number | null, t: TranslationFn) {
    if (effectiveRatingScore === null) {
        return t(
            'staff.rating.advice.noScore',
            'Рейтинг обновляется автоматически раз в сутки. Сосредоточьтесь на стабильном качестве сервиса.',
        );
    }
    if (effectiveRatingScore < 60) {
        return t(
            'staff.rating.advice.low',
            'Нужно подтянуть базу: просите клиентов оставлять отзывы, следите за пунктуальностью и не пропускайте смены.',
        );
    }
    if (effectiveRatingScore < 80) {
        return t(
            'staff.rating.advice.medium',
            'Хороший уровень. Для роста рейтинга: стабильно высокие оценки, меньше опозданий и больше возвращающихся клиентов.',
        );
    }
    return t(
        'staff.rating.advice.high',
        'Отличный рейтинг. Важно удерживать качество: не снижать уровень сервиса, вовремя выходить на смены и работать с постоянными клиентами.',
    );
}

export function getServiceName(serviceName: string | null): string {
    if (!serviceName) return '';
    return serviceName;
}

export function getEffectiveRatingScore(ratingScore?: number | null) {
    return typeof ratingScore === 'number' ? ratingScore : null;
}
