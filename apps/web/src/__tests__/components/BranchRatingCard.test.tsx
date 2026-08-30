/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
import { LanguageSwitcher } from '@/app/_components/i18n/LanguageSwitcher';
import BranchRatingCard from '@/app/dashboard/branches/[id]/BranchRatingCard';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));

const weights = {
    reviews: 35,
    productivity: 25,
    loyalty: 20,
    discipline: 20,
    windowDays: 30,
};

function renderCard(score: number | null = null) {
    return render(
        <LanguageProvider>
            <LanguageSwitcher />
            <BranchRatingCard score={score} weights={weights} />
        </LanguageProvider>,
    );
}

describe('BranchRatingCard', () => {
    beforeEach(() => {
        window.localStorage.clear();
        document.cookie = 'kezek_lang=ru; path=/';
        document.documentElement.lang = 'ru';
    });

    it('switches every rating section between Russian, English, and Kyrgyz', () => {
        renderCard();

        expect(screen.getByRole('heading', { name: 'Рейтинг филиала' })).toBeTruthy();
        expect(screen.getByText('Недостаточно данных')).toBeTruthy();
        expect(screen.getByText('Отзывы клиентов')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'English' }));
        expect(screen.getByRole('heading', { name: 'Branch rating' })).toBeTruthy();
        expect(screen.getByText('Not enough data yet')).toBeTruthy();
        expect(screen.getByText('Client reviews')).toBeTruthy();
        expect(screen.queryByText('Рейтинг филиала')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'Кыргызча' }));
        expect(screen.getByRole('heading', { name: 'Филиалдын рейтинги' })).toBeTruthy();
        expect(screen.getByText('Азырынча маалымат жетишсиз')).toBeTruthy();
        expect(screen.getByText('Кардарлардын пикирлери')).toBeTruthy();
    });

    it('shows a localized numeric score and all factor weights', () => {
        renderCard(82.4);

        expect(screen.getByText('82.4')).toBeTruthy();
        expect(screen.getByText('из 100')).toBeTruthy();
        expect(screen.getByText('35%')).toBeTruthy();
        expect(screen.getByText('25%')).toBeTruthy();
        expect(screen.getAllByText('20%')).toHaveLength(2);
    });
});
