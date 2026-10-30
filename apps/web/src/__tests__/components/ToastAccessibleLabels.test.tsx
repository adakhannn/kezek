/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { commonEn } from '@/app/_components/i18n/dictionaries/common.en';
import { commonKy } from '@/app/_components/i18n/dictionaries/common.ky';
import { commonRu } from '@/app/_components/i18n/dictionaries/common.ru';
import { Toast } from '@/components/ui/Toast';

let mockLocale: 'ru' | 'ky' | 'en' = 'ru';
const dictionaries: Record<string, Record<string, string>> = {ru: commonRu, ky: commonKy, en: commonEn};
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({useLanguage: () => ({
    t: (key: string, fallback?: string) => dictionaries[mockLocale][key] ?? fallback ?? key,
})}));

test.each([['ru','Закрыть уведомление'],['ky','Билдирүүнү жабуу'],['en','Close notification']] as const)(
    'toast dismissal is accessible in %s and preserves its alert role', (locale, label) => {
        mockLocale = locale;
        jest.useFakeTimers();
        const onClose = jest.fn();
        render(<Toast message="Test validation" type="error" duration={0} onClose={onClose} />);
        expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive');
        fireEvent.click(screen.getByRole('button', {name:label,exact:true}));
        expect(onClose).not.toHaveBeenCalled();
        act(() => { jest.advanceTimersByTime(300); });
        expect(onClose).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    },
);
