/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { ErrorDisplay } from '@/app/_components/ErrorDisplay';
import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';

describe('ErrorDisplay localization', () => {
    beforeEach(() => {
        document.cookie = 'kezek_lang=en; path=/';
        window.localStorage.setItem('kezek_locale', 'en');
    });

    it('localizes the imperative reload action', async () => {
        render(
            <LanguageProvider>
                <ErrorDisplay errorType="SERVICE_UNAVAILABLE" context="dashboard" />
            </LanguageProvider>,
        );

        expect(await screen.findByRole('button', { name: 'Reload page' })).toBeTruthy();
    });

    it.each([
        ['ru', 'Нет доступа к кабинету сотрудника', 'На главную', 'Войти под другой учётной записью'],
        ['ky', 'Кызматкердин кабинетине кирүүгө уруксат жок', 'Башкы бетке', 'Башка аккаунт менен кирүү'],
        ['en', 'No access to the staff workspace', 'Home', 'Sign in with another account'],
    ])('localizes staff denial and recovery links in %s', async (locale, title, home, signIn) => {
        document.cookie = `kezek_lang=${locale}; path=/`;
        window.localStorage.setItem('kezek_locale', locale);
        render(<LanguageProvider><ErrorDisplay errorType="NO_STAFF_RECORD" context="staff" /></LanguageProvider>);
        expect(await screen.findByRole('heading', { name: title })).toBeTruthy();
        expect(screen.getByRole('link', { name: home, exact: true }).getAttribute('href')).toBe('/');
        expect(screen.getByRole('link', { name: signIn, exact: true }).getAttribute('href')).toBe('/auth/sign-in');
        if (locale !== 'ru') {
            expect(screen.queryByText('Что делать:', { exact: true })).toBeNull();
            expect(screen.queryByText('Убедитесь, что вы авторизованы под правильной учётной записью.', { exact: true })).toBeNull();
        }
    });

    it.each([
        ['ru', 'Нет доступа к кабинету управления', 'Обратитесь к владельцу бизнеса, если вам нужен доступ к управлению.'],
        ['ky', 'Башкаруу кабинетине кирүүгө уруксат жок', 'Башкарууга кирүү керек болсо, бизнестин ээсине кайрылыңыз.'],
        ['en', 'No access to the management workspace', 'Contact the business owner if you need management access.'],
    ])('keeps denied-access guidance user-facing in %s, even in development', async (locale, title, help) => {
        jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'development' });
        document.cookie = `kezek_lang=${locale}; path=/`;
        window.localStorage.setItem('kezek_locale', locale);
        try {
            const { container } = render(
                <LanguageProvider>
                    <ErrorDisplay errorType="NO_BIZ_ACCESS" context="dashboard" diagnostics={{ checkedUserRoles: true, userRolesFound: 0 }} />
                </LanguageProvider>,
            );
            expect(await screen.findByRole('heading', { name: title })).toBeTruthy();
            expect(screen.getByText(help, { exact: true })).toBeTruthy();
            expect(screen.getByRole('link', { name: /Мои записи|Менин жазылыштарым|My bookings/, exact: true }).getAttribute('href')).toBe('/cabinet');
            expect(container.textContent).not.toMatch(/user_roles|businesses\.owner_id|user\.id|checkedUserRoles|userRolesFound/);
            expect(container.querySelector('pre')).toBeNull();
        } finally {
            jest.restoreAllMocks();
        }
    });
});
