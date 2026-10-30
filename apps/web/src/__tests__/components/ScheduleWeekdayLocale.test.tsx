/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { LanguageProvider, useLanguage } from '@/app/_components/i18n/LanguageProvider';
import ScheduleEditor from '@/components/scheduling/ScheduleEditor';

function LocaleButtons() {
    const { setLocale } = useLanguage();
    return <>{(['ru', 'en', 'ky'] as const).map(locale => <button key={locale} onClick={() => setLocale(locale)}>{locale}</button>)}</>;
}

describe('schedule weekday locale', () => {
    const originalFetch = global.fetch;
    beforeEach(() => {
        document.cookie = 'kezek_lang=ru; path=/';
        localStorage.setItem('kezek_locale', 'ru');
        global.fetch = jest.fn().mockImplementation((url: string) => Promise.resolve({
            ok: true, json: async () => ({ ok: true, data: url.includes('/time-off')
                ? { items: [], today: '2026-10-14' }
                : { revision: 1, timezone: 'Asia/Bishkek', today: '2026-10-14', days: [] } }),
        }));
    });
    afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

    it('switches all weekdays without relying on browser Kyrgyz ICU or writing the schedule', async () => {
        const DateTimeFormat = Intl.DateTimeFormat;
        jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) =>
            new DateTimeFormat(locale === 'ky-KG' ? 'ru-RU' : locale, options));
        render(<LanguageProvider><LocaleButtons /><ScheduleEditor staffId="staff" homeBranchId="branch" branches={[{ id: 'branch', name: 'Филиал' }]} /></LanguageProvider>);
        await screen.findByRole('heading', { name: 'понедельник — Выходной' });
        fireEvent.click(screen.getByRole('button', { name: 'en', exact: true }));
        await screen.findByRole('heading', { name: 'Monday — Day off' });
        fireEvent.click(screen.getByRole('button', { name: 'ky', exact: true }));
        for (const weekday of ['дүйшөмбү', 'шейшемби', 'шаршемби', 'бейшемби', 'жума', 'ишемби', 'жекшемби']) {
            expect(await screen.findByRole('heading', { name: `${weekday} — Эс алуу күнү` })).not.toBeNull();
        }
        fireEvent.click(screen.getByRole('button', { name: 'ru', exact: true }));
        await screen.findByRole('heading', { name: 'понедельник — Выходной' });
        expect((global.fetch as jest.Mock).mock.calls.every(([, options]) => !options.method)).toBe(true);
    });

    it('updates the loaded-draft status on a locale switch without discarding times or publishing', async () => {
        global.fetch = jest.fn().mockImplementation((url: string) => Promise.resolve({
            ok: true, json: async () => ({ ok: true, data: url.includes('/time-off')
                ? { items: [], today: '2026-10-14' }
                : url.includes('draftKind')
                    ? { revision: 1, source: 'week', branchId: 'branch', days: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, { intervals: i ? [] : [{ start: '09:00', end: '18:00' }], breaks: [] }])) }
                    : { revision: 1, timezone: 'Asia/Bishkek', today: '2026-10-14', days: [] } }),
        }));
        render(<LanguageProvider><LocaleButtons /><ScheduleEditor staffId="staff" homeBranchId="branch" branches={[{ id: 'branch', name: 'Филиал' }]} /></LanguageProvider>);
        const load = await screen.findByRole('button', { name: 'Загрузить действующий план в черновик' });
        await screen.findByDisplayValue('2026-10-14');
        fireEvent.click(load);
        await screen.findByText('Действующий план загружен в черновик. Изменения ещё не опубликованы.');
        fireEvent.click(screen.getByRole('button', { name: 'en', exact: true }));
        await screen.findByText('Current plan loaded into draft. Changes have not been published.');
        fireEvent.click(screen.getByRole('button', { name: 'ky', exact: true }));
        await screen.findByText('Учурдагы план долбоорго жүктөлдү. Өзгөртүүлөр жарыялана элек.');
        expect((screen.getByLabelText('Жумуш убактысы: Башталышы 1') as HTMLInputElement).value).toBe('09:00');
        expect((screen.getByLabelText('Жумуш убактысы: Аякташы 1') as HTMLInputElement).value).toBe('18:00');
        expect((global.fetch as jest.Mock).mock.calls.every(([, options]) => !options.method)).toBe(true);
    });
});
