/** @jest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';

import { BranchScheduleEditor } from '@/components/admin/branches/BranchScheduleEditor';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => ({ locale: 'ru', t: (key: string) => key }) }));

describe('branch day-by-day editor', () => {
    const originalFetch = global.fetch;
    beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }); });
    afterEach(() => { global.fetch = originalFetch; });
    test('preserves split intervals, different weekdays and breaks on save', async () => {
        const monday = { day_of_week: 1, intervals: [{ start: '08:00', end: '12:00' }, { start: '15:00', end: '19:00' }], breaks: [{ start: '10:00', end: '10:30' }] };
        const tuesday = { day_of_week: 2, intervals: [{ start: '11:00', end: '17:00' }], breaks: [] };
        render(<BranchScheduleEditor bizId="biz" branchId="branch" initialSchedule={[monday, tuesday]} />);
        fireEvent.click(screen.getByRole('button', { name: 'branches.schedule.saveButton' }));
        await screen.findByText('branches.schedule.success');
        const sent = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).schedule;
        expect(sent).toHaveLength(7);
        expect(sent[0]).toEqual(monday);
        expect(sent[1]).toEqual(tuesday);
        expect(sent[6]).toEqual({ day_of_week: 0, intervals: [], breaks: [] });
    });
    test('does not invent hours or write while opening the form', () => {
        const { container } = render(<BranchScheduleEditor bizId="biz" branchId="branch" />);
        expect(container.querySelector('input[type="time"]')).toBeNull();
        expect(global.fetch).not.toHaveBeenCalled();
    });
    test('rejects incomplete interval before any request', async () => {
        render(<BranchScheduleEditor bizId="biz" branchId="branch" />);
        fireEvent.click(within(screen.getByRole('region', { name: 'понедельник' })).getByRole('button', { name: 'scheduling.add' }));
        fireEvent.click(screen.getByRole('button', { name: 'branches.schedule.saveButton' }));
        await screen.findByText('scheduling.invalid');
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
