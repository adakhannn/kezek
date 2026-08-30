import { dashboardEn } from '@/app/_components/i18n/dictionaries/dashboard.en';
import { dashboardKy } from '@/app/_components/i18n/dictionaries/dashboard.ky';
import { dashboardRu } from '@/app/_components/i18n/dictionaries/dashboard.ru';

import { getDashboardHomeViewModel } from '../home/dashboardHomeViewModel';

const props = {
    bizName: 'Kezek Studio',
    bizCity: 'Osh',
    formattedDate: '2026-07-31T00:00:00.000Z',
    bookingsToday: 0,
    staffActive: 0,
    servicesActive: 0,
    branchesCount: 0,
    needOnboarding: true,
    ratingScore: null,
    ratingConfigScope: null,
    ratingWeights: null,
} as const;

function translator(dictionary: Record<string, string>) {
    return (key: string, fallback: string) => dictionary[key] ?? fallback;
}

describe('dashboard home localization', () => {
    test('English view model has no Russian fallback strings', () => {
        const viewModel = getDashboardHomeViewModel(props, 'en', translator(dashboardEn));
        const visibleStrings = [
            viewModel.primaryFocus.title,
            viewModel.primaryFocus.description,
            viewModel.primaryFocus.ctaLabel,
            ...viewModel.onboardingItems,
            ...viewModel.metricCards.flatMap((card) => [card.title, card.hint, card.actionLabel]),
            ...viewModel.quickActions.flatMap((action) => [action.title, action.hint, action.emphasis]),
        ];

        expect(visibleStrings.join(' ')).not.toMatch(/[А-Яа-яЁё]/);
        expect(viewModel.primaryFocus.title).toBe('Finish setting up your business workspace');
    });

    test('Kyrgyz and Russian dictionaries contain every dashboard home key', () => {
        const ky = getDashboardHomeViewModel(props, 'ky', translator(dashboardKy));
        const ru = getDashboardHomeViewModel(props, 'ru', translator(dashboardRu));

        expect(ky.primaryFocus.title).toBe('Алгач кабинетти иштөөгө даярдаңыз');
        expect(ky.quickActions.map((action) => action.emphasis)).toEqual([
            'Күндү көзөмөлдөө',
            'Команданы өстүрүү',
            'Кызматтар каталогу',
            'Иш тактыгы',
        ]);
        expect(ru.primaryFocus.ctaLabel).toBe('Завершить настройку');
    });
});
