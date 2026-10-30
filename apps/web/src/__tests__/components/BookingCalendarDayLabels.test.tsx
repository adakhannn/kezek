/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { BookingDateCalendar } from '@/app/b/[slug]/components/BookingDateCalendar';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { en, ky, ru } from '@/app/_components/i18n/dictionaries';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));

test.each([
    ['ky', '19.10.2026 (дүйшөмбү)', '20.10.2026 (шейшемби)'],
    ['ru', 'понедельник, 19 октября 2026 г.', 'вторник, 20 октября 2026 г.'],
    ['en', 'Monday, 19 October 2026', 'Tuesday, 20 October 2026'],
] as const)('%s calendar names preserve business-local selection and change instant', (locale, selectedLabel, nextLabel) => {
    const dictionary = { ru, en, ky }[locale];
    const t = (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key;
    jest.mocked(useLanguage).mockReturnValue({ locale, t } as ReturnType<typeof useLanguage>);
    const onChange = jest.fn();
    render(<BookingDateCalendar value={new Date('2026-10-18T18:00:00Z')}
        min={new Date('2026-10-14T18:00:00Z')} max={new Date('2026-11-14T18:00:00Z')}
        timezone="Asia/Bishkek" onChange={onChange} />);
    const selected = screen.getByRole('button', { name: selectedLabel, exact: true });
    expect(selected.getAttribute('data-date')).toBe('2026-10-19');
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(selected.hasAttribute('disabled')).toBe(false);
    const next = screen.getByRole('button', { name: nextLabel, exact: true });
    expect(next.getAttribute('data-date')).toBe('2026-10-20');
    fireEvent.click(next);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].toISOString()).toBe('2026-10-19T18:00:00.000Z');
    expect(screen.getByText('19.10.2026', { exact: true })).toBeTruthy();
});
