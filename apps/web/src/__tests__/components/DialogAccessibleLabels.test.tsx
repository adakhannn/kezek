/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { commonEn } from '@/app/_components/i18n/dictionaries/common.en';
import { commonKy } from '@/app/_components/i18n/dictionaries/common.ky';
import { commonRu } from '@/app/_components/i18n/dictionaries/common.ru';
import { Dialog } from '@/components/ui/Dialog';

let mockLocale: 'ru' | 'ky' | 'en' = 'ru';
const dictionaries: Record<string, Record<string, string>> = { ru: commonRu, ky: commonKy, en: commonEn };
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({
        locale: mockLocale,
        t: (key: string, fallback?: string) => dictionaries[mockLocale][key] ?? fallback ?? key,
    }),
}));

describe.each([
    ['ru', 'Закрыть окно'], ['ky', 'Терезени жабуу'], ['en', 'Close dialog'],
] as const)('Dialog accessible controls in %s', (locale, closeLabel) => {
    beforeEach(() => { mockLocale = locale; });

    it('announces the close action in the selected language and invokes only dismissal', () => {
        const onClose = jest.fn();
        render(<Dialog open title="Test confirmation" onClose={onClose}>Test content</Dialog>);
        expect(screen.getByRole('dialog', {name: 'Test confirmation'})).toBeTruthy();
        fireEvent.click(screen.getByRole('button', {name: closeLabel, exact: true}));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not expose a close action when dismissal is disabled', () => {
        const onClose = jest.fn();
        render(<Dialog open dismissible={false} title="Test confirmation" onClose={onClose}>Test content</Dialog>);
        expect(screen.queryByRole('button', {name: closeLabel, exact: true})).toBeNull();
        fireEvent.keyDown(window, {key: 'Escape'});
        expect(onClose).not.toHaveBeenCalled();
    });
});
