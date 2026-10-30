/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import DatePickerPopover from '@/components/pickers/DatePickerPopover';
import MonthPickerPopover from '@/components/pickers/MonthPickerPopover';
import { datePickerRu } from '@/app/_components/i18n/dictionaries/datePicker.ru';
import { datePickerKy } from '@/app/_components/i18n/dictionaries/datePicker.ky';
import { datePickerEn } from '@/app/_components/i18n/dictionaries/datePicker.en';
import { monthPickerRu } from '@/app/_components/i18n/dictionaries/monthPicker.ru';
import { monthPickerKy } from '@/app/_components/i18n/dictionaries/monthPicker.ky';
import { monthPickerEn } from '@/app/_components/i18n/dictionaries/monthPicker.en';

let mockLocale: 'ru' | 'ky' | 'en' = 'ru';
const dictionaries = {
    ru: {...datePickerRu, ...monthPickerRu},
    ky: {...datePickerKy, ...monthPickerKy},
    en: {...datePickerEn, ...monthPickerEn},
};
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({locale: mockLocale, t: (key: string, fallback: string) => dictionaries[mockLocale][key as keyof typeof dictionaries.ru] ?? fallback}),
}));
jest.mock('react-day-picker', () => ({DayPicker: () => null}));

describe.each(['ru','ky','en'] as const)('%s picker labels', (locale) => {
    beforeEach(() => { mockLocale = locale; });
    it('announces selected date without a raw template placeholder', () => {
        render(<DatePickerPopover value="2026-10-12" onChange={jest.fn()} />);
        const label = screen.getByTestId('date-picker').getAttribute('aria-label');
        expect(label).not.toContain('{value}');
        expect(label).toContain('2026');
        expect(label).toContain(locale === 'en' ? '12' : '12.10.2026');
    });
    it('announces selected month and keeps hook order stable when selection changes', () => {
        const {rerender} = render(<MonthPickerPopover value="2026-10-01" onChange={jest.fn()} />);
        expect(screen.getByRole('button').getAttribute('aria-label')).not.toContain('{value}');
        expect(screen.getByRole('button').getAttribute('aria-label')).toContain('2026');
        rerender(<MonthPickerPopover value="" onChange={jest.fn()} />);
        expect(screen.getByRole('button').getAttribute('aria-label')).toBe(dictionaries[locale]['monthPicker.open']);
    });
});
