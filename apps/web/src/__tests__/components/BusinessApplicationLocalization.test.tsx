/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
import { LanguageSwitcher } from '@/app/_components/i18n/LanguageSwitcher';
import { BusinessApplicationPageContent } from '@/app/business/apply/BusinessApplicationPageContent';

jest.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));

function renderPage(isAuthenticated: boolean) {
    return render(
        <LanguageProvider>
            <LanguageSwitcher />
            <BusinessApplicationPageContent
                categories={[{ slug: 'barbershop', name: 'Барбершоп' }]}
                initialValues={{}}
                isAuthenticated={isAuthenticated}
            />
        </LanguageProvider>,
    );
}

describe('Business application localization', () => {
    beforeEach(() => {
        window.localStorage.clear();
        document.cookie = 'kezek_lang=ru; path=/';
        document.documentElement.lang = 'ru';
    });

    it('switches all guest application content from Russian to Kyrgyz and English', () => {
        renderPage(false);

        expect(screen.getByRole('heading', { name: 'Подключить бизнес к Kezek' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Войдите перед отправкой заявки' })).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Кыргызча' }));
        expect(screen.getByRole('heading', { name: 'Бизнести Kezekке кошуу' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Арыз жөнөтүүдөн мурун кириңиз' })).toBeTruthy();
        expect(document.documentElement.lang).toBe('ky');

        fireEvent.click(screen.getByRole('button', { name: 'English' }));
        expect(screen.getByRole('heading', { name: 'Connect a business to Kezek' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Sign in before submitting an application' })).toBeTruthy();
        expect(document.documentElement.lang).toBe('en');
    });

    it('switches authenticated form labels, actions, and server error codes', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ ok: false, code: 'active_limit' }),
        });
        const { container } = renderPage(true);

        fireEvent.click(screen.getByRole('button', { name: 'English' }));

        expect(screen.getByLabelText('Your name')).toBeTruthy();
        expect(screen.getByLabelText('Business category')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Submit application' })).toBeTruthy();
        expect(screen.queryByText('Отправить заявку')).toBeNull();

        fireEvent.change(screen.getByLabelText('Business category'), {
            target: { value: 'barbershop' },
        });
        fireEvent.submit(container.querySelector('form')!);
        await waitFor(() => expect(screen.getByText(
            'You already have the maximum number of active applications. Wait for a decision or cancel an unnecessary application.',
        )).toBeTruthy());

        fireEvent.click(screen.getByRole('button', { name: 'Кыргызча' }));
        expect(screen.getByText(
            'Активдүү арыздардын максималдуу санына жеттиңиз. Чечимди күтүңүз же керексиз арызды жокко чыгарыңыз.',
        )).toBeTruthy();
    });
});
