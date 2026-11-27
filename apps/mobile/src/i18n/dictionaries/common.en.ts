import type { commonRu } from './common.ru';

export const commonEn: Record<keyof typeof commonRu, string> = {
    'common.loading': 'Loading...',
    'common.language.title': 'Language',
    'common.language.hint': 'Language of the app, server messages and notifications',
    'common.rating.noRating': 'Not enough data for rating',
    'common.days.one': '{count} day',
    'common.days.few': '{count} days',
    'common.days.many': '{count} days',
};
