/** @jest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { LanguageProvider, useLanguage } from '@/app/_components/i18n/LanguageProvider';

let resolveEnglish: ((dictionary: Record<string, string>) => void) | null = null;
const mockLoadDictionary = jest.fn(() => new Promise<Record<string, string>>((resolve) => { resolveEnglish = resolve; }));
jest.mock('@/app/_components/i18n/dictionaryLoader', () => {
    const actual = jest.requireActual('@/app/_components/i18n/dictionaryLoader');
    return {
        ...actual,
        // Production state: only Russian is in memory.
        loadedDictionary: (locale: string) => (locale === 'ru' ? actual.russianDictionary : undefined),
        loadDictionary: (locale: string) => mockLoadDictionary(locale),
        rememberDictionary: jest.fn(),
    };
});

function Label() {
    const { t } = useLanguage();
    return <p>{t('common.error', 'fallback')}</p>;
}

// FE-06: every page carried the dictionaries of all three languages.
describe('dictionaries by language', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resolveEnglish = null;
        window.localStorage.clear();
        document.cookie = 'kezek_locale=; path=/; max-age=0';
    });

    test('a switch to English shows Russian until the English chunk arrives, then English', async () => {
        window.localStorage.setItem('kezek_locale', 'en');
        render(<LanguageProvider initialLocale="ru"><Label /></LanguageProvider>);

        expect(await screen.findByText('Ошибка')).toBeTruthy();
        expect(mockLoadDictionary).toHaveBeenCalledWith('en');
        await act(async () => resolveEnglish?.({ 'common.error': 'Error' }));
        expect(screen.getByText('Error')).toBeTruthy();
    });

    test('a page rendered in English gets its dictionary from the server: no flash, no extra load', () => {
        document.cookie = 'kezek_locale=en; path=/';
        render(
            <LanguageProvider initialLocale="en" initialDictionary={{ 'common.error': 'Error' }}>
                <Label />
            </LanguageProvider>,
        );

        expect(screen.getByText('Error')).toBeTruthy();
        expect(mockLoadDictionary).not.toHaveBeenCalled();
    });

    test('the client provider and the Russian module do not import other languages', () => {
        const i18n = path.join(process.cwd(), 'src/app/_components/i18n');
        const provider = readFileSync(path.join(i18n, 'LanguageProvider.tsx'), 'utf8');
        const russian = readFileSync(path.join(i18n, 'dictionaries/ru.ts'), 'utf8');

        // Only a type import from the index (erased at build); values come from dictionaryLoader.
        expect(provider.match(/^import (?!type )[^;]*from '\.\/dictionaries(\/(en|ky))?';/gm)).toBeNull();
        expect(provider).toMatch(/import type \{ I18nKey \} from '\.\/dictionaries';/);
        expect(russian).not.toMatch(/\b\w+(En|Ky)\b/);
        expect(russian).not.toMatch(/\.(en|ky)'/);
    });
});
