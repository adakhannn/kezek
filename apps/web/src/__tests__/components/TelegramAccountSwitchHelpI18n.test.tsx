/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { authRu } from '@/app/_components/i18n/dictionaries/auth.ru';
import { authKy } from '@/app/_components/i18n/dictionaries/auth.ky';
import { authEn } from '@/app/_components/i18n/dictionaries/auth.en';
import { cabinetRu } from '@/app/_components/i18n/dictionaries/cabinet.ru';
import { cabinetKy } from '@/app/_components/i18n/dictionaries/cabinet.ky';
import { cabinetEn } from '@/app/_components/i18n/dictionaries/cabinet.en';
import { TelegramAccountSwitchHelp } from '@/components/auth/TelegramAccountSwitchHelp';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));

test.each([
    ['ru', authRu, cabinetRu, 'Подключить другой Telegram-аккаунт', 'Telegram запомнил аккаунт в браузере', 'Обновить кнопку'],
    ['ky', authKy, cabinetKy, 'Башка Telegram аккаунтун туташтыруу', 'Telegram браузердеги аккаунтту эстеп калды', 'Баскычты жаңылоо'],
    ['en', authEn, cabinetEn, 'Connect another Telegram account', 'Telegram remembers the account in this browser', 'Refresh button'],
] as const)('localizes profile account explanation and Telegram help in %s', (locale, auth, cabinet, label, title, refresh) => {
    const dictionary: Record<string, string> = { ...auth, ...cabinet };
    jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key } as ReturnType<typeof useLanguage>);
    expect(dictionary['cabinet.profile.connections.hint']).toBeTruthy();
    if (locale !== 'ru') expect(dictionary['cabinet.profile.connections.hint']).not.toMatch(/Все подключённые|аккаунт Kezek/);
    const onRefresh = jest.fn();
    render(<TelegramAccountSwitchHelp context="link" onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: label, exact: true }));
    const dialog = screen.getByRole('dialog', { name: title });
    for (const key of ['step1', 'step2', 'step3', 'appHint']) {
        expect(within(dialog).getByText(dictionary[`auth.telegramSwitch.${key}`], { exact: true })).toBeTruthy();
    }
    fireEvent.click(within(dialog).getByRole('button', { name: refresh, exact: true }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
});

test.each([
    ['ru', authRu, 'Войти с другого Telegram-аккаунта'],
    ['ky', authKy, 'Башка Telegram аккаунту менен кирүү'],
    ['en', authEn, 'Sign in with another Telegram account'],
] as const)('preserves the shared login label and Escape close in %s', (locale, auth, label) => {
    const dictionary: Record<string, string> = auth;
    jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key } as ReturnType<typeof useLanguage>);
    const onRefresh = jest.fn();
    render(<TelegramAccountSwitchHelp context="login" onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole('button', { name: label, exact: true }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onRefresh).not.toHaveBeenCalled();
});
