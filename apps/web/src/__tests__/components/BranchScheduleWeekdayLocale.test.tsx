/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { getT } from '@/app/_components/i18n/server';
import { BranchScheduleEditor } from '@/components/admin/branches/BranchScheduleEditor';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
const initialSchedule = [{ day_of_week: 1, intervals: [{ start: '09:00', end: '18:00' }], breaks: [] }];
const originalFetch = global.fetch;
beforeEach(() => { global.fetch = jest.fn(); });
afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

test.each([
    ['ru', ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']],
    ['en', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']],
    ['ky', ['дүйшөмбү', 'шейшемби', 'шаршемби', 'бейшемби', 'жума', 'ишемби', 'жекшемби']],
] as const)('branch weekday labels use %s even when browser Kyrgyz ICU falls back to Russian', (locale, weekdays) => {
    const DateTimeFormat = Intl.DateTimeFormat;
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((language, options) =>
        new DateTimeFormat(language === 'ky-KG' ? 'ru-RU' : language, options));
    const t = getT(locale);
    jest.mocked(useLanguage).mockReturnValue({ locale, t } as ReturnType<typeof useLanguage>);
    render(<BranchScheduleEditor bizId="business-2" branchId="branch-1" initialSchedule={initialSchedule} apiBase="/api/branches" />);
    weekdays.forEach((name, index) => {
        expect(screen.getByRole('heading', { level: 4, name: index ? `${name} — ${t('scheduling.closed')}` : name })).toBeTruthy();
        expect(screen.getByRole('region', { name })).toBeTruthy();
    });
    expect(screen.getByLabelText(`${t('scheduling.work')}: ${t('scheduling.start')} 1`)).toHaveProperty('value', '09:00');
    expect(screen.getByLabelText(`${t('scheduling.work')}: ${t('scheduling.end')} 1`)).toHaveProperty('value', '18:00');
    expect(global.fetch).not.toHaveBeenCalled();
});
