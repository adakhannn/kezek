export const dashboardLocaleMap: Record<string, string> = {
    ky: 'ky-KG',
    ru: 'ru-RU',
    en: 'en-US',
};

export function formatDashboardHomeDate(formattedDate: string, locale: string) {
    const today = new Date(formattedDate);
    const formatter = new Intl.DateTimeFormat(dashboardLocaleMap[locale] || 'ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
    const localizedDate = formatter.format(today);
    return localizedDate.charAt(0).toUpperCase() + localizedDate.slice(1);
}

export function getDashboardBizName(bizName: string | null, fallbackName: string) {
    return bizName || fallbackName;
}

export function shouldShowLowRatingHint(ratingScore: number | null | undefined) {
    return ratingScore !== null && ratingScore !== undefined && ratingScore <= 10;
}
