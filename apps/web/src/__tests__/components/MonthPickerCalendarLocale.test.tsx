/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';

import MonthPickerPopover from '@/components/pickers/MonthPickerPopover';
import { datePickerRu } from '@/app/_components/i18n/dictionaries/datePicker.ru';
import { datePickerKy } from '@/app/_components/i18n/dictionaries/datePicker.ky';
import { datePickerEn } from '@/app/_components/i18n/dictionaries/datePicker.en';
import { monthPickerRu } from '@/app/_components/i18n/dictionaries/monthPicker.ru';
import { monthPickerKy } from '@/app/_components/i18n/dictionaries/monthPicker.ky';
import { monthPickerEn } from '@/app/_components/i18n/dictionaries/monthPicker.en';

let mockLocale: 'ru' | 'ky' | 'en' = 'ru';
const dictionaries = {
    ru: { ...datePickerRu, ...monthPickerRu },
    ky: { ...datePickerKy, ...monthPickerKy },
    en: { ...datePickerEn, ...monthPickerEn },
};
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({
        locale: mockLocale,
        t: (key: string, fallback: string) =>
            dictionaries[mockLocale][key as keyof typeof dictionaries.ru] ?? fallback,
    }),
}));

describe.each(['ru', 'ky', 'en'] as const)('%s real month calendar', (locale) => {
    beforeEach(() => { mockLocale = locale; });

    it('localizes internal month/year controls and month options', () => {
        render(<MonthPickerPopover value="2026-11-01" onChange={jest.fn()} />);
        fireEvent.click(screen.getByRole('button'));
        const month = screen.getByRole('combobox', { name: dictionaries[locale]['datePicker.monthLabel'] });
        expect(screen.getByRole('combobox', { name: dictionaries[locale]['datePicker.yearLabel'] })).toBeTruthy();
        expect(within(month).getByRole('option', { name: locale === 'en' ? 'November' : 'ноябрь' })).toBeTruthy();
        expect(screen.getByRole('grid').getAttribute('aria-label')).toContain(locale === 'en' ? 'November' : 'ноябрь');
    });

    it('keeps month-first normalization and Escape cancellation without data writes', () => {
        const onChange = jest.fn();
        render(<MonthPickerPopover value="2026-11-01" onChange={onChange} />);
        const trigger = screen.getByRole('button');
        fireEvent.click(trigger);
        const name = locale === 'en' ? /Monday, November 2nd, 2026/ : /понедельник, 2 ноября 2026/;
        fireEvent.click(screen.getByRole('button', { name }));
        expect(onChange).toHaveBeenCalledWith('2026-11-01');
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).toBeNull();
        fireEvent.click(trigger);
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
        expect(onChange).toHaveBeenCalledTimes(1);
    });
});
